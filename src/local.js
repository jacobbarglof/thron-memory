// Local mode: pages are plain .md files in one folder on this computer.
// Open the folder in any editor or Obsidian; sync or back it up however you like.

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { handleBody } from "./mcp.js";
import { validId } from "./pages.js";

export const CONFIG_DIR = path.join(os.homedir(), ".thron-memory");
export const DEFAULT_DIR = process.env.THRON_MEMORY_DIR || path.join(os.homedir(), "thron-memory");
const KEEP_VERSIONS = 20;

export function fileStore(dir = DEFAULT_DIR) {
  const file = (id) => path.join(dir, `${id}.md`);
  let ready = null;
  const init = () => (ready ||= fs.mkdir(dir, { recursive: true }));
  return {
    dir,
    async list() {
      await init();
      const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".md"));
      const out = [];
      for (const n of names) {
        const id = n.slice(0, -3);
        if (!validId(id)) continue;
        out.push({ id, text: await fs.readFile(path.join(dir, n), "utf8") });
      }
      return out;
    },
    async get(id) {
      await init();
      try { return await fs.readFile(file(id), "utf8"); } catch { return null; }
    },
    async put(id, text) {
      await init();
      const prev = await this.get(id);
      if (prev !== null) {
        const vdir = path.join(dir, ".versions", id);
        await fs.mkdir(vdir, { recursive: true });
        await fs.writeFile(path.join(vdir, `${new Date().toISOString().replace(/[:.]/g, "-")}.md`), prev);
        const old = (await fs.readdir(vdir)).sort();
        for (const n of old.slice(0, Math.max(0, old.length - KEEP_VERSIONS))) await fs.unlink(path.join(vdir, n));
      }
      const tmp = file(id) + ".tmp";
      await fs.writeFile(tmp, text);
      await fs.rename(tmp, file(id)); // atomic: a crash never leaves half a page
    },
  };
}

// MCP over stdio: one JSON message per line in, one per line out.
export function serveStdio(store = fileStore()) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  let queue = Promise.resolve(); // handle messages in order so writes never interleave
  rl.on("line", (line) => {
    if (!line.trim()) return;
    queue = queue.then(async () => {
      let body;
      try { body = JSON.parse(line); } catch {
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
        return;
      }
      const res = await handleBody(store, body);
      if (res) process.stdout.write(JSON.stringify(res) + "\n");
    });
  });
  rl.on("close", () => queue.then(() => process.exit(0)));
}
