// Builds the two downloads attached to each GitHub release:
//   dist/thron-memory.mcpb        Claude Desktop extension (double-click to install)
//   dist/thron-memory-skill.zip   the skill, for claude.ai and ChatGPT uploads
// Usage: node scripts/build.mjs   (needs npx; fetches @anthropic-ai/mcpb to pack)

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const stage = path.join(dist, "mcpb");
const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;

rmSync(dist, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const p of ["bin", "src", "LICENSE", "package.json"]) cpSync(path.join(root, p), path.join(stage, p), { recursive: true });
const manifest = JSON.parse(readFileSync(path.join(root, "desktop", "manifest.json"), "utf8"));
manifest.version = version;
writeFileSync(path.join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));

const sh = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });
sh(`npx -y @anthropic-ai/mcpb@latest pack "${stage}" "${path.join(dist, "thron-memory.mcpb")}"`);
cpSync(path.join(root, "thron-memory-skill.zip"), path.join(dist, "thron-memory-skill.zip"));
rmSync(stage, { recursive: true, force: true });
console.log("Built dist/thron-memory.mcpb and dist/thron-memory-skill.zip");
