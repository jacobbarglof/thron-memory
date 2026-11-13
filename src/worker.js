// Cloud mode: a Cloudflare Worker in YOUR OWN free Cloudflare account.
// Pages live in one Durable Object (a tiny private database). It sleeps when unused,
// so it costs nothing on the free plan. Phone and laptop agents all reach the same URL.
//
// Two ways to set it up:
// - Browser (Deploy to Cloudflare button): you pick a password during deploy. Your memory's
//   own web page creates the secret link and shows it when you enter that password.
//   The link is stored only encrypted with your password.
// - Command line (`thron-memory cloud`): the link is made on your computer and Cloudflare
//   only ever gets its SHA-256 hash.
//
// Privacy design:
// - Requests are checked against the SHA-256 hash of the secret token in your link.
// - Every page, including its name, is encrypted with AES-256-GCM using keys derived from
//   the token (HKDF). Storage holds only ciphertext under random-looking keys, so a copy
//   of the database without your URL is unreadable.
// - Request logging is turned off in the deploy config.
// Limit: while a request is being handled, the Worker decrypts pages in memory to search
// them. If you need nothing to ever leave your computer, use local mode.
//
// Routes (the token is in the path so phone apps can use a plain URL):
//   GET  /                 setup page (browser setup)
//   POST /api/state|claim|link   setup page actions (password protected, rate limited)
//   POST /mcp/<token>      MCP Streamable HTTP endpoint (or POST /mcp with Bearer token)
//   GET  /export/<token>   all pages as JSON (backups)
//   POST /import/<token>   add or replace pages from JSON {pages:[{id,text}]}

import { handleBody } from "./mcp.js";
import { validId } from "./pages.js";
import { SETUP_PAGE } from "./page.js";

const KEEP_VERSIONS = 20;
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const sha256hex = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const b64 = (u8) => { let s = ""; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKeys(token) {
  const base = await crypto.subtle.importKey("raw", enc.encode(token), "HKDF", false, ["deriveKey", "deriveBits"]);
  const hkdf = (info) => ({ name: "HKDF", hash: "SHA-256", salt: enc.encode("thron-memory"), info: enc.encode(info) });
  const aes = await crypto.subtle.deriveKey(hkdf("page-encryption-v1"), base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const macBits = await crypto.subtle.deriveBits(hkdf("page-name-v1"), base, 256);
  const mac = await crypto.subtle.importKey("raw", macBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return {
    // Storage slot for a page name: HMAC, so names are hidden but lookups stay direct.
    slot: async (id) => hex(await crypto.subtle.sign("HMAC", mac, enc.encode(id))).slice(0, 32),
    seal: async (slot, obj) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(slot) }, aes, enc.encode(JSON.stringify(obj))));
      const out = new Uint8Array(12 + ct.length);
      out.set(iv); out.set(ct, 12);
      return `v1.${b64(out)}`;
    },
    open: async (slot, sealed) => {
      try {
        const raw = unb64(sealed.slice(3));
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12), additionalData: enc.encode(slot) }, aes, raw.slice(12));
        return JSON.parse(dec.decode(pt));
      } catch {
        return null; // written with a different token: unreadable, skipped
      }
    },
  };
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-protocol-version, mcp-session-id",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (!parts.length) {
      return new Response(SETUP_PAGE, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "referrer-policy": "no-referrer" },
      });
    }
    const stub = env.MEMORY.get(env.MEMORY.idFromName("memory"));

    if (parts[0] === "api" && request.method === "POST") {
      const inner = new Request(`https://do/api/${parts[1] || ""}`, request);
      inner.headers.set("x-setup-password", env.MEMORY_PASSWORD || "");
      inner.headers.set("x-cli-mode", env.MEMORY_TOKEN_HASH ? "1" : "");
      inner.headers.set("x-origin", url.origin);
      return stub.fetch(inner);
    }

    if (!["mcp", "export", "import"].includes(parts[0])) return new Response("Not found\n", { status: 404 });
    let token = parts[1];
    const auth = request.headers.get("authorization") || "";
    if (!token && auth.startsWith("Bearer ")) token = auth.slice(7);
    if (!token || token.length < 20) return new Response("Not found\n", { status: 404, headers: CORS });

    const inner = new Request(`https://do/${parts[0]}`, request);
    inner.headers.set("x-memory-token", token); // stays inside Cloudflare, never stored
    const cliOk = env.MEMORY_TOKEN_HASH && sameSecret(await sha256hex(token), env.MEMORY_TOKEN_HASH);
    inner.headers.set("x-token-ok", cliOk ? "1" : "");
    const res = await stub.fetch(inner);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
    return out;
  },
};

// Browser setup: PBKDF2 turns the password into a key that wraps the secret link token.
async function passwordKey(password, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 50_000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function wrapToken(password, token) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await passwordKey(password, salt), enc.encode(token)));
  return { salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function unwrapToken(password, w) {
  try {
    const key = await passwordKey(password, unb64(w.salt));
    return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(w.iv) }, key, unb64(w.ct)));
  } catch {
    return null;
  }
}
const newToken = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// One Durable Object holds every page. It runs one request at a time, so writes never race.
export class MemoryStore {
  constructor(ctx) {
    this.storage = ctx.storage;
    this.keys = null;
    this.keysFor = null;
  }

  async store(token) {
    const th = await sha256hex(token);
    if (this.keysFor !== th) { this.keys = await deriveKeys(token); this.keysFor = th; }
    const s = this.storage;
    const k = this.keys;
    return {
      async list() {
        const out = [];
        for (const [key, sealed] of await s.list({ prefix: "p:" })) {
          const page = await k.open(key.slice(2), sealed);
          if (page) out.push(page);
        }
        return out;
      },
      async get(id) {
        const slot = await k.slot(id);
        const sealed = await s.get(`p:${slot}`);
        return sealed ? (await k.open(slot, sealed))?.text ?? null : null;
      },
      async put(id, text) {
        const slot = await k.slot(id);
        const prev = await s.get(`p:${slot}`);
        if (prev != null) {
          await s.put(`v:${slot}:${new Date().toISOString()}`, prev);
          const vers = [...(await s.list({ prefix: `v:${slot}:` })).keys()];
          if (vers.length > KEEP_VERSIONS) await s.delete(vers.slice(0, vers.length - KEEP_VERSIONS));
        }
        await s.put(`p:${slot}`, await k.seal(slot, { id, text }));
      },
    };
  }

  // Browser setup actions. The page sends the password; we answer with the private link.
  async setup(action, request) {
    const s = this.storage;
    const envPassword = request.headers.get("x-setup-password") || "";
    const cli = request.headers.get("x-cli-mode") === "1";
    const origin = request.headers.get("x-origin");
    const claimed = !!(await s.get("auth:wrapped"));

    if (action === "state") return json({ claimed, cli, password: !!envPassword });

    const lock = (await s.get("auth:lock")) || { fails: 0, until: 0 };
    if (lock.until > Date.now()) {
      return json({ error: `Too many wrong passwords. Try again in ${Math.ceil((lock.until - Date.now()) / 60000)} minute(s).` }, 429);
    }
    const wrong = async () => {
      lock.fails += 1;
      if (lock.fails >= 5) { lock.until = Date.now() + 15 * 60_000; lock.fails = 0; }
      await s.put("auth:lock", lock);
      return json({ error: "That password is not right. Check for typos and try again." }, 403);
    };
    let body = {};
    try { body = await request.json(); } catch {}
    const password = typeof body.password === "string" ? body.password : "";
    const link = (token) => `${origin}/mcp/${token}`;

    if (action === "claim") {
      if (cli) return json({ error: "This memory was set up from the command line. On that computer, run: npx -y thron-memory url" }, 409);
      if (claimed) return json({ error: "Your memory is already set up. Use \"Show my link\" instead." }, 409);
      if (!envPassword) return json({ error: "No password was set when this was deployed. In Cloudflare, open this Worker, go to Settings > Variables and Secrets, add a secret named MEMORY_PASSWORD, then try again." }, 409);
      if (!sameSecret(await sha256hex(password), await sha256hex(envPassword))) return wrong();
      const token = newToken();
      await s.put("auth:hash", await sha256hex(token));
      await s.put("auth:wrapped", await wrapToken(password, token));
      await s.put("auth:lock", { fails: 0, until: 0 });
      return json({ link: link(token) });
    }

    if (action === "link") {
      if (!claimed) return json({ error: "Your memory is not set up yet." }, 409);
      const token = await unwrapToken(password, await s.get("auth:wrapped"));
      if (!token) return wrong();
      // If the password was changed in Cloudflare, re-lock the link with the new one.
      if (envPassword && envPassword !== password) await s.put("auth:wrapped", await wrapToken(envPassword, token));
      await s.put("auth:lock", { fails: 0, until: 0 });
      return json({ link: link(token) });
    }

    if (action === "reset") {
      // Forgot the password: the user sets a new MEMORY_PASSWORD in Cloudflare, then
      // starts over here. The old memory cannot be decrypted without the old link, so it is erased.
      if (cli || !envPassword) return json({ error: "Set a new MEMORY_PASSWORD secret in Cloudflare first." }, 409);
      if (!sameSecret(await sha256hex(password), await sha256hex(envPassword))) return wrong();
      if (body.confirm !== "ERASE") return json({ error: "Type ERASE to confirm." }, 400);
      for (const prefix of ["p:", "v:", "auth:"]) {
        const keys = [...(await s.list({ prefix })).keys()];
        for (let i = 0; i < keys.length; i += 128) await s.delete(keys.slice(i, i + 128));
      }
      const token = newToken();
      await s.put("auth:hash", await sha256hex(token));
      await s.put("auth:wrapped", await wrapToken(password, token));
      return json({ link: link(token) });
    }

    return json({ error: "Unknown action" }, 404);
  }

  async fetch(request) {
    const route = new URL(request.url).pathname.slice(1);
    if (route.startsWith("api/")) return this.setup(route.slice(4), request);

    const token = request.headers.get("x-memory-token");
    if (!token) return new Response("Not found\n", { status: 404 });
    if (request.headers.get("x-token-ok") !== "1") {
      const claimed = await this.storage.get("auth:hash");
      if (!claimed || !sameSecret(await sha256hex(token), claimed)) return new Response("Not found\n", { status: 404 });
    }
    const store = await this.store(token);

    if (route === "mcp") {
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
      let body;
      try { body = await request.json(); } catch {
        return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
      }
      const res = await handleBody(store, body);
      return res ? json(res) : new Response(null, { status: 202 });
    }

    if (route === "export" && request.method === "GET") {
      return json({ exported: new Date().toISOString(), pages: await store.list() });
    }

    if (route === "import" && request.method === "POST") {
      const { pages = [] } = await request.json();
      let n = 0;
      for (const p of pages) {
        if (!validId(p?.id) || typeof p.text !== "string" || p.text.length > 200_000) continue;
        await store.put(p.id, p.text);
        n++;
      }
      return json({ imported: n });
    }

    return new Response("Not found\n", { status: 404 });
  }
}
