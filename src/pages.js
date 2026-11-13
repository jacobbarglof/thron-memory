// Page format: Markdown with a small YAML-like header, then sections.
//
// ---
// title: Alex Kim
// updated: 2026-11-13
// status: current
// tags: [people]
// ---
// One or two sentences a person can skim.
//
// ## Current
// - Works at Acme (2026-11-13, chat)
//
// ## History
// - [2026-11-13] was: Works at Initech
//
// Pure functions only, so the same code runs in Node and in a Cloudflare Worker.

export const today = () => new Date().toISOString().slice(0, 10);

export function validId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(id);
}

export function toId(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function parse(text) {
  const meta = {};
  let body = text.replace(/\r\n/g, "\n");
  const m = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
      if (!kv) continue;
      let v = kv[2].trim();
      if (v.startsWith("[") && v.endsWith("]")) {
        v = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
      }
      meta[kv[1]] = v;
    }
    body = body.slice(m[0].length);
  }
  const sections = [];
  const parts = body.split(/^## /m);
  const summary = parts.shift().trim();
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const name = (nl === -1 ? p : p.slice(0, nl)).trim();
    const content = nl === -1 ? "" : p.slice(nl + 1).trim();
    sections.push({ name, content });
  }
  return { meta, summary, sections };
}

export function render(page) {
  const { meta, summary, sections } = page;
  const head = Object.entries(meta)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : v}`)
    .join("\n");
  let out = `---\n${head}\n---\n`;
  if (summary) out += `${summary}\n`;
  for (const s of sections) out += `\n## ${s.name}\n${s.content ? s.content + "\n" : ""}`;
  return out;
}

export function newPage(id, title, summary = "") {
  return {
    meta: { title: title || id, updated: today(), status: "current" },
    summary,
    sections: [{ name: "Current", content: "" }],
  };
}

export function section(page, name, create = true) {
  const want = name.toLowerCase();
  let s = page.sections.find((x) => x.name.toLowerCase() === want);
  if (!s && create) {
    s = { name, content: "" };
    // Keep History near the end, before Open questions / Sources if they exist.
    const tail = page.sections.findIndex((x) => /^(open questions|sources)$/i.test(x.name));
    if (want !== "history" && name !== "Open questions") {
      const h = page.sections.findIndex((x) => x.name.toLowerCase() === "history");
      const at = h !== -1 ? h : tail;
      at === -1 ? page.sections.push(s) : page.sections.splice(at, 0, s);
    } else if (tail !== -1 && want === "history") {
      page.sections.splice(tail, 0, s);
    } else {
      page.sections.push(s);
    }
  }
  return s;
}

export function appendLine(s, line) {
  s.content = s.content ? `${s.content}\n${line}` : line;
}

export function links(text) {
  return [...new Set([...text.matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]*)?\]\]/g)].map((m) => m[1]))];
}

// Things that must never be stored. Cheap pattern checks, not a guarantee.
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bsk-ant-[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\b(password|passwd|passcode|api[_ -]?key|secret|token)\s*[:=]\s*\S{4,}/i,
  /\/(mcp|export|import)\/[A-Za-z0-9_-]{32,}/, // a thron-memory connector URL
  /\b\d{3}-\d{2}-\d{4}\b/, // US SSN shape
  /\b(?:\d[ -]?){15,16}\b/, // card-number shape
];

export function looksSecret(text) {
  return SECRET_PATTERNS.some((r) => r.test(text));
}
