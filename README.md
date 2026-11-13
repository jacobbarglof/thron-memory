# thron-memory

One private memory for all your AI agents, on your laptop and your phone.

Tell Claude something on your phone. Codex knows it on your laptop an hour later. Nothing to host, no database to run, no account with us (there is no "us").

- **Private.** Local mode never sends anything anywhere. Cloud mode runs in *your own* free Cloudflare account, encrypted.
- **Tiny.** Under 1,000 lines of plain JavaScript, zero dependencies. Uses no CPU when idle.
- **Readable.** Your memory is a folder of Markdown pages you can open, edit and back up.
- **Safe by default.** Refuses to store passwords and keys. Never deletes: old facts move to History, old versions are kept.

## Install (one prompt)

Paste this into Claude Code, Codex, Cursor, or any agent that can run commands on your computer:

```text
Install thron-memory for me: run `npx -y github:jacobbarglof/thron-memory setup` and tell me what it printed.
```

Or run it yourself (needs [Node.js](https://nodejs.org) 18 or newer):

```bash
npx -y github:jacobbarglof/thron-memory setup
```

That creates your memory folder (`~/thron-memory`) and connects every agent it finds on this computer: Claude Code, Codex, Claude Desktop and Cursor. Restart your agent and ask: *"What do you remember about me?"*

## Add your phone (one more prompt)

Phone apps can only reach memory over the internet, so this step puts it in your own Cloudflare account. It is free and needs no credit card.

```text
Set up thron-memory for my phone: run `npx -y github:jacobbarglof/thron-memory cloud`. If a Cloudflare sign-in page opens, I'll sign in.
```

When it finishes, a small window shows your private connector URL. Then, once:

1. Open **claude.ai > Settings > Connectors > Add custom connector**.
2. Name it **Memory** and paste the URL.

Done. The Claude app on your phone, claude.ai and Claude Desktop now share one memory with your laptop agents.

**ChatGPT:** where your plan allows custom connectors (developer mode), add the same URL as a connector with no authentication.

Lost the window? Run `npx -y github:jacobbarglof/thron-memory url`.

## Add the skill (optional, recommended for web and phone)

The [skill](skill/thron-memory/SKILL.md) teaches agents on claude.ai and ChatGPT when to read and write memory, and how to keep it private. Laptop agents already get the same guidance from the server.

- **claude.ai:** download [`thron-memory-skill.zip`](thron-memory-skill.zip), then **Customize > Skills > Upload**.
- **ChatGPT** (plans with Skills): **Skills > Create > Upload from your computer**, same zip.

## How it works

Your memory is a set of short pages, one per person, project or topic:

```markdown
---
title: Alex Kim
updated: 2026-11-13
status: current
---
My manager at Acme.

## Current
- Prefers afternoon meetings (2026-11-13, chat)

## History
- [2026-11-13] was: Prefers morning meetings (2026-10-02, email)
```

Agents get six tools:

| Tool | What it does |
|---|---|
| `overview` | Start of every task: your rules for agents, a list of pages, the inbox, anything in conflict |
| `search` | Finds facts and returns short snippets, not whole pages |
| `read` | Reads a page or one section of it |
| `remember` | Saves a fact to the right page, or to the inbox if unsure |
| `update_fact` | Changes a fact; the old one moves to History with the date |
| `write_page` | Rewrites a page (filing the inbox, merging); the old version is kept |

Two special pages:

- **`core`** holds your rules for agents. Edit it to change how they behave, for example *"Always answer in Spanish"* or *"Never save anything about my health."*
- **`inbox`** collects facts an agent was unsure where to put. Agents file them later.

The ideas come from ThronOS, a personal system where one memory serves every agent: facts live on one page each, changes keep their history, conflicts are flagged for you instead of guessed, and agents write as they work without being asked. This project is just that memory, nothing else.

## Privacy

| | Local mode | Cloud mode |
|---|---|---|
| Where pages live | `~/thron-memory` on your computer | A Durable Object (small database) in your own Cloudflare account |
| Who can read them | You and the agents you connect | Anyone holding your connector URL |
| At rest | Plain Markdown files | AES-256-GCM encrypted, page names hidden. The key comes from your URL, which Cloudflare never stores (it keeps only a hash) |
| Logs | None | Request logging turned off |
| Works offline | Yes | No |

Details worth knowing:

- **Your AI provider sees what agents read.** When Claude or ChatGPT reads a page, that text goes to them like anything else in the chat. Keep truly secret things out of memory.
- **Treat the connector URL like a password.** It is shown to you, never printed into an agent's output. Rotate it: run `backup`, delete `token` in `~/.thron-memory/config.json`, run `cloud` again.
- **While a request runs,** the Cloudflare Worker decrypts pages in memory to search them. If that is too much, stay in local mode.
- **Secrets are refused.** Text that looks like a password, API key, token, card or ID number is not saved. This is a pattern check, not a guarantee.
- No telemetry, no analytics, no calls home. Read the code: it is small on purpose ([`src/`](src)).

## Commands

```bash
npx -y github:jacobbarglof/thron-memory setup    # memory folder + connect agents on this computer
npx -y github:jacobbarglof/thron-memory cloud    # add your phone (your Cloudflare account)
npx -y github:jacobbarglof/thron-memory url      # show your private connector URL
npx -y github:jacobbarglof/thron-memory backup   # copy cloud memory into ~/thron-memory
npx -y github:jacobbarglof/thron-memory status   # where memory lives
```

Setup copies the server into `~/.thron-memory/app`, so agents start it from disk with no network. Run `setup` again to update.

## Connect other agents

Any MCP client works. Local (stdio), after running `setup` once (use your real home folder path):

```json
{ "mcpServers": { "thron-memory": { "command": "node", "args": ["/Users/you/.thron-memory/app/bin/cli.js"] } } }
```

Cloud (Streamable HTTP): use your connector URL, or `https://<your-worker>.workers.dev/mcp` with the header `Authorization: Bearer <token>`.

## FAQ

**What does it cost?** Nothing. Local mode is your own disk. Cloud mode fits easily in Cloudflare's free plan, and the server sleeps when nobody uses it.

**Can I edit memory myself?** Yes. Open `~/thron-memory` in any editor or [Obsidian](https://obsidian.md). In cloud mode, run `backup` first to get a fresh copy; edits you make locally are not pushed back automatically.

**What if I lose the URL?** It is saved on the computer that ran `cloud`, in `~/.thron-memory/config.json`. If that is gone too, the cloud copy cannot be decrypted. Run `backup` now and then.

**Uninstall?** Remove `thron-memory` from your agents (`claude mcp remove thron-memory -s user`, `codex mcp remove thron-memory`), delete `~/.thron-memory`, and for cloud mode delete the `thron-memory` Worker in the Cloudflare dashboard. Your pages stay in `~/thron-memory` until you delete them.

## Develop

```bash
git clone https://github.com/jacobbarglof/thron-memory
cd thron-memory
npm test
```

`src/memory.js` is the memory and its tools, `src/mcp.js` the protocol, `src/local.js` the file store, `src/worker.js` the encrypted cloud store, `bin/cli.js` the commands.

## License

[MIT](LICENSE)
