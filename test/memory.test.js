import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callTool } from "../src/memory.js";
import { fileStore } from "../src/local.js";
import worker, { MemoryStore, sha256hex } from "../src/worker.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "thron-mem-"));
const t = (r) => r.content[0].text;

test("remember, search, read, update_fact, write_page", async () => {
  const s = fileStore(tmp());
  assert.match(t(await callTool(s, "overview")), /Core rules|At the start of a task/);
  assert.match(t(await callTool(s, "remember", { fact: "Prefers morning meetings", page: "alex-kim", title: "Alex Kim", source: "chat" })), /Created page alex-kim/);
  assert.match(t(await callTool(s, "remember", { fact: "Prefers morning meetings", page: "alex-kim" })), /Already/);
  assert.match(t(await callTool(s, "remember", { fact: "Loose idea about gardens" })), /inbox/);

  const ov = t(await callTool(s, "overview"));
  assert.match(ov, /alex-kim: Alex Kim/);
  assert.match(ov, /1 fact\(s\) waiting/);

  assert.match(t(await callTool(s, "search", { query: "morning meetings" })), /alex-kim > Current: - Prefers morning meetings/);
  assert.match(t(await callTool(s, "search", { query: "zebra" })), /No matches/);

  assert.match(t(await callTool(s, "update_fact", { page: "alex-kim", old_text: "morning", new_text: "Prefers afternoon meetings" })), /Updated/);
  const page = t(await callTool(s, "read", { page: "alex-kim" }));
  assert.match(page, /## Current\n- Prefers afternoon meetings/);
  assert.match(page, /## History\n- \[\d{4}-\d{2}-\d{2}\] was: Prefers morning meetings/);
  assert.match(t(await callTool(s, "read", { page: "alex-kim", section: "history" })), /was: Prefers morning/);

  assert.match(t(await callTool(s, "write_page", { page: "inbox", content: "---\ntitle: Inbox\n---\nEmpty.\n\n## Current\n" })), /Wrote/);
  assert.equal(readdirSync(path.join(s.dir, ".versions", "inbox")).length, 1, "previous version kept");
});

test("refuses secrets and bad ids", async () => {
  const s = fileStore(tmp());
  assert.ok((await callTool(s, "remember", { fact: "My api key: sk-abcdefghijklmnopqrstuvwxyz123" })).isError);
  assert.ok((await callTool(s, "remember", { fact: "password = hunter22" })).isError);
  assert.ok((await callTool(s, "remember", { fact: "Memory URL https://x.workers.dev/mcp/abcdefghijklmnopqrstuvwxyz0123456789ABC" })).isError);
  // Filing from the inbox keeps the original date.
  await callTool(s, "remember", { fact: "Old fact (2025-01-02, email)", page: "old" });
  assert.match(t(await callTool(s, "read", { page: "old" })), /- Old fact \(2025-01-02, email\)\n/);
  assert.ok((await callTool(s, "remember", { fact: "x", page: "../etc/passwd" })).isError);
  assert.ok((await callTool(s, "remember", { fact: "x", page: "core" })).isError);
  assert.ok((await callTool(s, "read", { page: "Bad Id" })).isError);
});

test("stdio MCP handshake and tool call", async () => {
  const dir = tmp();
  const p = spawn(process.execPath, [path.join(ROOT, "bin", "cli.js")], { env: { ...process.env, THRON_MEMORY_DIR: dir } });
  const lines = [];
  let buf = "";
  p.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const send = (m) => p.stdin.write(JSON.stringify(m) + "\n");
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "remember", arguments: { fact: "Lives in Ames", page: "me", title: "Me" } } });
  p.stdin.end();
  await new Promise((r) => p.on("close", r));
  assert.equal(lines.length, 3, "notification gets no reply");
  assert.equal(lines[0].result.serverInfo.name, "thron-memory");
  assert.ok(lines[0].result.instructions);
  assert.equal(lines[1].result.tools.length, 6);
  assert.match(lines[2].result.content[0].text, /Created page me/);
  assert.match(readFileSync(path.join(dir, "me.md"), "utf8"), /- Lives in Ames/);
});

// A fake Durable Object storage that behaves like ctx.storage's key-value API.
function fakeStorage() {
  const m = new Map();
  return {
    async get(k) { return m.get(k); },
    async put(k, v) { m.set(k, v); },
    async delete(ks) { for (const k of [].concat(ks)) m.delete(k); },
    async list({ prefix }) { return new Map([...m].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b))); },
  };
}

test("cloud worker: auth, MCP over HTTP, export/import", async () => {
  const storage = fakeStorage();
  const obj = new MemoryStore({ storage });
  const env = { MEMORY_TOKEN_HASH: await sha256hex("secret123secret123secret123"), MEMORY: { idFromName: () => "x", get: () => ({ fetch: (r) => obj.fetch(r) }) } };
  const call = (p, init) => worker.fetch(new Request(`https://m.example.workers.dev${p}`, init), env);
  const rpc = (p, body) => call(p, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

  assert.equal((await rpc("/mcp/wrong", { jsonrpc: "2.0", id: 1, method: "ping" })).status, 404);
  assert.equal((await rpc("/mcp", { jsonrpc: "2.0", id: 1, method: "ping" })).status, 404);
  const init = await (await rpc("/mcp/secret123secret123secret123", { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } })).json();
  assert.equal(init.result.protocolVersion, "2025-03-26");
  assert.equal((await rpc("/mcp/secret123secret123secret123", { jsonrpc: "2.0", method: "notifications/initialized" })).status, 202);

  const bearer = await call("/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "remember", arguments: { fact: "Phone fact", page: "phone" } } }), headers: { authorization: "Bearer secret123secret123secret123" } });
  assert.match((await bearer.json()).result.content[0].text, /Created page phone/);

  await rpc("/mcp/secret123secret123secret123", { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "update_fact", arguments: { page: "phone", old_text: "Phone fact", new_text: "New phone fact" } } });
  const exp = await (await call("/export/secret123secret123secret123")).json();
  assert.equal(exp.pages.length, 1);
  assert.match(exp.pages[0].text, /New phone fact[\s\S]*was: Phone fact/);

  const imp = await (await call("/import/secret123secret123secret123", { method: "POST", body: JSON.stringify({ pages: [{ id: "laptop", text: "---\ntitle: Laptop\n---\nhi\n" }, { id: "../x", text: "bad" }] }) })).json();
  assert.equal(imp.imported, 1);
  const s = await (await rpc("/mcp/secret123secret123secret123", { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "search", arguments: { query: "laptop" } } })).json();
  assert.match(s.result.content[0].text, /laptop/);

  // At rest: only ciphertext, page names hidden, versions kept.
  const raw = JSON.stringify([...(await storage.list({ prefix: "" }))]);
  assert.doesNotMatch(raw, /phone|laptop|Phone fact/i);
  assert.match(raw, /"v:[0-9a-f]{32}:/);
  // A different token sees nothing.
  const other = new MemoryStore({ storage });
  const st = await other.store("another-token");
  assert.equal((await st.list()).length, 0);
});

test("browser setup: claim with password, show link again, lockout, page", async () => {
  const storage = fakeStorage();
  const obj = new MemoryStore({ storage });
  const env = { MEMORY_PASSWORD: "correct horse battery", MEMORY: { idFromName: () => "x", get: () => ({ fetch: (r) => obj.fetch(r) }) } };
  const call = (p, init) => worker.fetch(new Request(`https://m.example.workers.dev${p}`, init), env);
  const api = async (a, body) => (await call(`/api/${a}`, { method: "POST", body: JSON.stringify(body || {}) })).json();

  const page = await call("/");
  assert.match(await page.text(), /Your Memory/);
  assert.deepEqual(await api("state"), { claimed: false, cli: false, password: true });
  assert.match((await api("claim", { password: "nope" })).error, /not right/);
  const { link } = await api("claim", { password: "correct horse battery" });
  assert.match(link, /^https:\/\/m\.example\.workers\.dev\/mcp\/[A-Za-z0-9_-]{40,}$/);
  assert.match((await api("claim", { password: "correct horse battery" })).error, /already set up/);
  assert.equal((await api("link", { password: "correct horse battery" })).link, link);

  // The link works for MCP; a wrong token does not.
  const token = link.split("/mcp/")[1];
  const rpc = (t, body) => call(`/mcp/${t}`, { method: "POST", body: JSON.stringify(body) });
  const r = await (await rpc(token, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "remember", arguments: { fact: "Likes green", page: "me" } } })).json();
  assert.match(r.result.content[0].text, /Created page me/);
  assert.equal((await rpc("x".repeat(43), { jsonrpc: "2.0", id: 1, method: "ping" })).status, 404);

  // Storage never holds the token or the password in the clear.
  const raw = JSON.stringify([...(await storage.list({ prefix: "" }))]);
  assert.ok(!raw.includes(token) && !raw.includes("correct horse") && !raw.includes("Likes green"));

  // Removing the password secret after setup still lets the password show the link.
  delete env.MEMORY_PASSWORD;
  assert.equal((await api("link", { password: "correct horse battery" })).link, link);

  // Five wrong tries lock it for a while.
  for (let i = 0; i < 5; i++) await api("link", { password: "bad" });
  assert.match((await api("link", { password: "correct horse battery" })).error, /Too many/);

  // Forgot password: new secret in Cloudflare, then start over (erases old memory).
  await storage.put("auth:lock", { fails: 0, until: 0 });
  env.MEMORY_PASSWORD = "brand new password";
  assert.match((await api("reset", { password: "brand new password" })).error, /ERASE/);
  const fresh = await api("reset", { password: "brand new password", confirm: "ERASE" });
  assert.notEqual(fresh.link, link);
  const t2 = fresh.link.split("/mcp/")[1];
  const ov = await (await rpc(t2, { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "search", arguments: { query: "green" } } })).json();
  assert.match(ov.result.content[0].text, /No matches/);
  assert.equal((await rpc(token, { jsonrpc: "2.0", id: 1, method: "ping" })).status, 404);
});
