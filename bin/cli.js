#!/usr/bin/env node
// thron-memory command line.
//   thron-memory            run the MCP server over stdio (what agents launch)
//   thron-memory setup      create the memory folder and connect agents on this computer
//   thron-memory cloud      put memory in your own Cloudflare account so your phone can use it
//   thron-memory url        show your private phone connector URL (to you, not to agents)
//   thron-memory backup     copy cloud memory into the local folder
//   thron-memory status     show where memory lives

import { spawnSync } from "node:child_process";
import { promises as fs, existsSync, readFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { fileStore, serveStdio, CONFIG_DIR, DEFAULT_DIR } from "../src/local.js";
import { ensureCore, VERSION } from "../src/memory.js";

const NAME = "thron-memory";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CONFIG = path.join(CONFIG_DIR, "config.json");
const WIN = process.platform === "win32";
const RUN = "npx -y github:jacobbarglof/thron-memory"; // how users run commands

const say = (s = "") => process.stderr.write(s + "\n"); // stdout is reserved for MCP
const out = (s = "") => process.stdout.write(s + "\n");

function readConfig() {
  try { return JSON.parse(readFileSync(CONFIG, "utf8")); } catch { return {}; }
}
async function writeConfig(c) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG, JSON.stringify(c, null, 2), { mode: 0o600 });
}

function run(cmd, args, opts = {}) {
  // shell:true lets Windows find .cmd shims (npx, claude, codex). Args here are our own, never user text.
  const quoted = args.map((a) => (/^[\w@./:=-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`));
  return spawnSync(cmd, quoted, { shell: true, encoding: "utf8", ...opts });
}
const has = (cmd) => run(cmd, ["--version"]).status === 0;

// Where the server runs from. Setup copies these few files into ~/.thron-memory/app so
// agents start it straight from disk: no network at launch, no global npm install,
// works offline. A git clone (for development) runs in place.
const APP = existsSync(path.join(ROOT, ".git")) ? ROOT : path.join(CONFIG_DIR, "app");

async function installApp() {
  if (path.resolve(APP) === ROOT) return;
  await fs.rm(APP, { recursive: true, force: true });
  for (const p of ["bin", "src", "package.json", "LICENSE"]) {
    if (existsSync(path.join(ROOT, p))) await fs.cp(path.join(ROOT, p), path.join(APP, p), { recursive: true });
  }
}

// How agents should launch this server (absolute node path: works even when GUI apps lack PATH).
function selfCommand() {
  return { command: process.execPath.replace(/\\/g, "/"), args: [path.join(APP, "bin", "cli.js").replace(/\\/g, "/")] };
}

function desktopConfigPath() {
  if (WIN) return path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
}

async function editJson(file, fn) {
  let data = {};
  try { data = JSON.parse(await fs.readFile(file, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
  fn(data);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// Connect every agent we can find. target = { url } for cloud, otherwise local stdio.
async function connectAgents(target = {}) {
  const done = [];
  const local = selfCommand();

  if (has("claude")) {
    run("claude", ["mcp", "remove", NAME, "-s", "user"]);
    const r = target.url
      ? run("claude", ["mcp", "add", "-s", "user", "--transport", "http", NAME, target.url])
      : run("claude", ["mcp", "add", "-s", "user", NAME, "--", local.command, ...local.args]);
    done.push(r.status === 0 ? "Claude Code" : `Claude Code (failed: ${(r.stderr || r.stdout).trim()})`);
  }

  if (has("codex")) {
    run("codex", ["mcp", "remove", NAME]);
    const r = target.url
      ? run("codex", ["mcp", "add", NAME, "--url", target.url])
      : run("codex", ["mcp", "add", NAME, "--", local.command, ...local.args]);
    done.push(r.status === 0 ? "Codex" : `Codex (failed: ${(r.stderr || r.stdout).trim()})`);
  }

  const desktop = desktopConfigPath();
  if (existsSync(path.dirname(desktop))) {
    await editJson(desktop, (d) => {
      d.mcpServers ||= {};
      if (target.url) delete d.mcpServers[NAME]; // the claude.ai connector covers Desktop in cloud mode
      else d.mcpServers[NAME] = { command: local.command, args: local.args };
    });
    done.push(target.url ? "Claude Desktop (uses your claude.ai connector now)" : "Claude Desktop (restart it)");
  }

  const cursorDir = path.join(os.homedir(), ".cursor");
  if (existsSync(cursorDir)) {
    await editJson(path.join(cursorDir, "mcp.json"), (d) => {
      d.mcpServers ||= {};
      d.mcpServers[NAME] = target.url ? { url: target.url } : { command: local.command, args: local.args };
    });
    done.push("Cursor");
  }
  return done;
}

async function setup() {
  await installApp();
  const store = fileStore();
  await ensureCore(store);
  const cfg = readConfig();
  if (cfg.url) {
    say(`Memory is in the cloud (${mask(cfg.url)}). Reconnecting agents to it.`);
    const done = await connectAgents({ url: cfg.url });
    say(`Connected: ${done.join(", ") || "none found"}`);
    return;
  }
  const done = await connectAgents();
  out(`thron-memory ${VERSION} is set up.

Memory folder: ${store.dir}
Connected: ${done.join(", ") || "no agents found (see README: Connect other agents)"}

Restart your agent, then ask it: "What do you remember about me?"
To use the same memory from your phone, run: ${RUN} cloud`);
}

const mask = (u) => u.replace(/\/mcp\/.+$/, "/mcp/••••••");

function wrangler(args, opts) {
  return run("npx", ["-y", "wrangler@4", ...args], opts);
}

async function cloud() {
  await installApp();
  const cfg = readConfig();
  cfg.token ||= randomBytes(32).toString("base64url");
  await writeConfig(cfg);

  const wdir = path.join(CONFIG_DIR, "worker");
  await fs.mkdir(wdir, { recursive: true });
  const conf = path.join(wdir, "wrangler.json");
  await fs.writeFile(conf, JSON.stringify({
    name: NAME,
    main: path.join(APP, "src", "worker.js").replace(/\\/g, "/"),
    compatibility_date: "2025-09-01",
    workers_dev: true,
    observability: { enabled: false }, // no request logs stored
    durable_objects: { bindings: [{ name: "MEMORY", class_name: "MemoryStore" }] },
    migrations: [{ tag: "v1", new_sqlite_classes: ["MemoryStore"] }],
  }, null, 2));

  say("Step 1 of 4: Cloudflare sign-in (free account; a browser window opens if needed)");
  const who = wrangler(["whoami"]);
  if (who.status !== 0 || /not authenticated/i.test(`${who.stdout}${who.stderr}`)) {
    const r = wrangler(["login"], { stdio: "inherit" });
    if (r.status !== 0) return fail("Cloudflare sign-in did not finish. Run this command again.");
  }

  say("Step 2 of 4: deploying your private memory server");
  const d = wrangler(["deploy", "--config", conf], { stdio: ["inherit", "pipe", "pipe"] });
  const log = `${d.stdout || ""}\n${d.stderr || ""}`;
  const base = log.match(/https:\/\/[\w.-]+\.workers\.dev/)?.[0];
  if (d.status !== 0 || !base) {
    say(log);
    if (/workers\.dev subdomain/i.test(log)) return fail("Cloudflare needs a workers.dev subdomain first. Open dash.cloudflare.com > Workers & Pages once, pick a subdomain, then run this again.");
    return fail("Deploy failed (output above).");
  }

  say("Step 3 of 4: locking it with your secret key (Cloudflare only gets its hash)");
  const hash = createHash("sha256").update(cfg.token).digest("hex");
  const s = wrangler(["secret", "put", "MEMORY_TOKEN_HASH", "--config", conf], { input: hash });
  if (s.status !== 0) { say(s.stderr); return fail("Could not set the secret key."); }

  cfg.url = `${base}/mcp/${cfg.token}`;
  cfg.base = base;
  await writeConfig(cfg);

  // Wait for the secret to reach Cloudflare's edge, then copy local pages up.
  say("Step 4 of 4: copying your existing memory up");
  let ok = false;
  for (let i = 0; i < 20 && !ok; i++) {
    try { ok = (await fetch(`${base}/export/${cfg.token}`)).ok; } catch {}
    if (!ok) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!ok) return fail(`The server is deployed but not answering yet. Wait a minute and run: ${RUN} cloud`);
  const pages = await fileStore().list();
  const remote = await (await fetch(`${base}/export/${cfg.token}`)).json();
  const have = new Set(remote.pages.map((p) => p.id));
  const fresh = pages.filter((p) => !have.has(p.id)); // never overwrite cloud pages on a re-run
  if (fresh.length) {
    await fetch(`${base}/import/${cfg.token}`, { method: "POST", body: JSON.stringify({ pages: fresh }), headers: { "content-type": "application/json" } });
  }

  const done = await connectAgents({ url: cfg.url });
  out(`
Your memory now lives in your own Cloudflare account, encrypted (free plan, sleeps when unused).
Copied up: ${fresh.length} page(s). Connected on this computer: ${done.join(", ") || "none found"}.

PHONE (do this once, on any device):
  1. Open claude.ai > Settings > Connectors > Add custom connector
  2. Name: Memory. URL: your private connector URL (see below)
  3. Done. The Claude app on your phone and Claude Desktop now share the same memory.`);
  await showUrl(cfg);
  out(`Back up anytime with: ${RUN} backup`);
}

// The connector URL is the only key to your memory. It is shown to a person, never
// printed into an agent's output (which may be sent to an AI provider and logged).
async function showUrl(cfg = readConfig()) {
  if (!cfg.url) return fail(`No cloud memory yet. Run: ${RUN} cloud`);
  if (process.stdout.isTTY) {
    out(`\nYour private connector URL (treat it like a password):\n\n  ${cfg.url}\n`);
    return;
  }
  const file = path.join(CONFIG_DIR, "connector-url.txt");
  await fs.writeFile(file, `Your private thron-memory connector URL. Treat it like a password.\nPaste it into claude.ai > Settings > Connectors > Add custom connector.\n\n${cfg.url}\n`, { mode: 0o600 });
  const opener = WIN ? ["cmd", ["/c", "start", '""', file]] : [process.platform === "darwin" ? "open" : "xdg-open", [file]];
  run(opener[0], opener[1]);
  out(`\nYour private connector URL was opened in a window for you (file: ${file}).
Agent: do not read or repeat that file; the user copies the URL themselves.`);
}

async function backup() {
  const cfg = readConfig();
  if (!cfg.base) return fail(`Memory is local only; your folder is already the copy: ${DEFAULT_DIR}`);
  const r = await fetch(`${cfg.base}/export/${cfg.token}`);
  if (!r.ok) return fail(`Server answered ${r.status}.`);
  const { pages } = await r.json();
  const store = fileStore();
  for (const p of pages) if ((await store.get(p.id)) !== p.text) await store.put(p.id, p.text);
  out(`Backed up ${pages.length} page(s) to ${store.dir} (older local copies kept in .versions).`);
}

function status() {
  const cfg = readConfig();
  out(cfg.url
    ? `Mode: cloud (encrypted)\nServer: ${mask(cfg.url)}\nShow the connector URL: ${RUN} url\nLocal backup folder: ${DEFAULT_DIR}`
    : `Mode: local (nothing leaves this computer)\nMemory folder: ${DEFAULT_DIR}`);
}

function fail(msg) {
  say(`\nError: ${msg}`);
  process.exitCode = 1;
}

const cmd = process.argv[2];
const commands = { setup, cloud, backup, status, url: () => showUrl() };
if (!cmd || cmd === "serve") {
  if (process.stdin.isTTY && !cmd) {
    say(`thron-memory ${VERSION}: an MCP memory server. Agents start it for you.\nCommands: setup | cloud | url | backup | status`);
  } else serveStdio();
} else if (commands[cmd]) {
  Promise.resolve(commands[cmd]()).catch((e) => fail(e.message));
} else {
  say(`Unknown command "${cmd}". Commands: setup | cloud | url | backup | status`);
  process.exitCode = 1;
}
