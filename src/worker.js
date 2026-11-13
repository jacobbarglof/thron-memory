// Cloud mode: a Cloudflare Worker in YOUR OWN free Cloudflare account.
// Pages live in one Durable Object (a tiny private database). It sleeps when unused,
// so it costs nothing on the free plan. Phone and laptop agents all reach the same URL.
//
// Privacy design:
// - The secret token lives only in your connector URL and ~/.thron-memory/config.json.
//   Cloudflare stores just its SHA-256 hash (to check requests), never the token itself.
// - Every page, including its name, is encrypted with AES-256-GCM using keys derived from
//   the token (HKDF). Storage holds only ciphertext under random-looking keys, so a copy
//   of the database without your URL is unreadable.
// - Request logging is turned off in the deploy config.
// Limit: while a request is being handled, the Worker decrypts pages in memory to search
// them. If you need nothing to ever leave your computer, use local mode.
//
// Routes (the token is in the path so phone apps can use a plain URL):
//   POST /mcp/<token>      MCP Streamable HTTP endpoint (or POST /mcp with Bearer token)
//   GET  /export/<token>   all pages as JSON (backups)
//   POST /import/<token>   add or replace pages from JSON {pages:[{id,text}]}

import { handleBody } from "./mcp.js";
import { validId } from "./pages.js";

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length) return new Response("thron-memory is running.\n");
    if (!env.MEMORY_TOKEN_HASH) return new Response("Not set up: MEMORY_TOKEN_HASH secret is missing.\n", { status: 503 });

    let token = parts[1];
    const auth = request.headers.get("authorization") || "";
    if (!token && auth.startsWith("Bearer ")) token = auth.slice(7);
    if (!token || !sameSecret(await sha256hex(token), env.MEMORY_TOKEN_HASH)) return new Response("Not found\n", { status: 404 });

    const stub = env.MEMORY.get(env.MEMORY.idFromName("memory"));
    const inner = new Request(`https://do/${parts[0]}`, request);
    inner.headers.set("x-memory-token", token); // stays inside Cloudflare, never stored
    return stub.fetch(inner);
  },
};

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

  async fetch(request) {
    const route = new URL(request.url).pathname.slice(1);
    const token = request.headers.get("x-memory-token");
    if (!token) return new Response("Not found\n", { status: 404 });
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
