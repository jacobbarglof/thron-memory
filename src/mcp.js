// Minimal MCP (Model Context Protocol) server: JSON-RPC 2.0, tools only.
// No SDK and no dependencies, so it starts instantly and is easy to audit.

import { TOOLS, INSTRUCTIONS, VERSION, callTool } from "./memory.js";

const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

// Handle one JSON-RPC message. Returns a response object, or null for notifications.
export async function handle(store, msg) {
  const { id, method, params } = msg || {};
  const isNote = id === undefined || id === null;
  const ok = (result) => (isNote ? null : { jsonrpc: "2.0", id, result });
  const err = (code, message) => (isNote ? null : { jsonrpc: "2.0", id, error: { code, message } });

  try {
    switch (method) {
      case "initialize": {
        const asked = params?.protocolVersion;
        return ok({
          protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "thron-memory", version: VERSION },
          instructions: INSTRUCTIONS,
        });
      }
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: TOOLS });
      case "tools/call":
        return ok(await callTool(store, params?.name, params?.arguments || {}));
      default:
        if (method?.startsWith("notifications/")) return null;
        return err(-32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return err(-32603, `Internal error: ${e?.message || e}`);
  }
}

// Handle a parsed request body that may be a single message or a batch.
export async function handleBody(store, body) {
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(store, m)))).filter(Boolean);
    return out.length ? out : null;
  }
  return handle(store, body);
}
