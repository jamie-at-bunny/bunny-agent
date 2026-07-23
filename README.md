# Bunny Agent

An embeddable AI agent for [bunny.net](https://bunny.net). Talks to Claude, acts on natural language: create databases, define schemas with SQL, spin up storage buckets and hand back credentials, manage CDN, DNS, edge scripts, container apps, and Stream video libraries.

## Monorepo layout

Follows the bunny-upload convention: a shared wire contract, a backend handler, a framework-agnostic frontend core, and thin framework wrappers. Everything ships under the `@bunny.net` npm scope; a backend installs `@bunny.net/agent`, a frontend installs the wrapper for its framework.

```
packages/
  agent/         @bunny.net/agent         — BACKEND, and the only package a
                 server needs. The Claude agent loop as web-standard
                 Request→Response handlers; mount it in Hono, Next, Bun, etc.
                 The only package that touches secrets. Re-exports the tool
                 registry and the wire types.
  shared/        @bunny.net/agent-shared  — wire types (AgentEvent, AgentStatus). No deps.
  tools/         @bunny.net/agent-tools   — Bunny API client + the 41-tool registry.
                 Single source of truth: every tool (name, description,
                 JSON schema, run function) is defined once here.
  core/          @bunny.net/agent-core    — FRONTEND core. Framework-agnostic
                 client (SSE streaming, transcript reducer) + styles.css.
                 Use directly from Angular/Vue/vanilla.
  react/         @bunny.net/agent-react   — <BunnyAgentChat /> React wrapper.
  angular/       @bunny.net/agent-angular — <bunny-agent-chat> Angular wrapper.
  mcp/           @bunny.net/agent-mcp     — MCP server (stdio) over the same
                 tool registry, for Claude Code / Claude Desktop.
apps/
  server/        Hono server mounting @bunny.net/agent (port 8787).
  web/           Vite + TanStack Router/Query app (port 3000):
                 /            standalone chat page
                 /widget      compact chat designed to be iframed
                 /embed.js    one-script-tag embed for the Bunny Dashboard
                 /embed-demo.html  fake dashboard to try the embed
```

## Setup

```bash
pnpm install
pnpm build
```

Create `.env` at the repo root (see `.env.example`):

- **OpenRouter**: `OPENROUTER_API_KEY=sk-or-...` (required for the agent loop)
- **Bunny**: `BUNNY_API_KEY=...` — optional; falls back to the `bunny` CLI's
  profile (`bunny login`).

## Run

```bash
pnpm dev   # starts the API server (8787) and the web app (3000)
```

Open http://localhost:3000. Try:

- "Create a database called todo-app and add a tasks table with title, done, created_at"
- "Create a storage bucket for user uploads and give me the credentials"
- "Add an A record for api.example.com pointing at 1.2.3.4"

## Embedding

**Script tag (any page, e.g. the Bunny Dashboard):**

```html
<script src="https://<agent-host>/embed.js" async></script>
```

A floating 🐰 launcher opens the agent in an iframe. Use
`data-agent-origin="https://..."` to point at a different deployment.

**React component:**

```tsx
import { BunnyAgentChat } from "@bunny.net/agent-react";
import "@bunny.net/agent-core/styles.css";

<BunnyAgentChat baseUrl="https://agent.example.com" compact />;
```

Theme via CSS variables on `.ba-chat` (`--ba-accent`, `--ba-surface`,
`--ba-radius`, ...) or override the stable `ba-*` class names.

**Angular component:** standalone, signal-based (Angular ≥19). Add the core
stylesheet to `angular.json` (`"styles": ["node_modules/@bunny.net/agent-core/styles.css", ...]`),
then:

```ts
import { BunnyAgentChatComponent } from "@bunny.net/agent-angular";

@Component({
  imports: [BunnyAgentChatComponent],
  template: `
    <bunny-agent-chat
      baseUrl="https://agent.example.com"
      [compact]="true"
      (toolSuccess)="onToolSuccess($event)"
      (toolError)="onToolError($event)"
    />
  `,
})
export class ChatPage {}
```

Same theming story: CSS variables on `.ba-chat` or the stable `ba-*` classes.

**Reacting to tool runs:** every surface exposes `onToolSuccess` /
`onToolError` callbacks carrying the tool name, its input, and its result —
e.g. navigate to a resource page the moment the agent creates it:

```tsx
<BunnyAgentChat
  baseUrl="https://agent.example.com"
  onToolSuccess={({ name, result }) => {
    if (name === "create_pull_zone") {
      router.push(`/pullzones/${(result as { id: number }).id}`);
    }
  }}
  onToolError={({ name, error }) => toast.error(`${name} failed: ${error}`)}
/>
```

The same options exist on `new BunnyAgentClient({ ... })` for non-React
apps, and on `createBunnyAgentHandler({ ... })` server-side (with
`sessionId` included) for audit logging and webhooks.

**Persistence:** by default the transcript lives in component state and a
page reload starts a fresh conversation. Pass `persist` to keep the session
id and transcript in localStorage across reloads (a string value overrides
the storage key — needed when one origin embeds multiple independent
chats). A "new chat" button appears once a conversation exists.

```tsx
<BunnyAgentChat persist />
```

For custom storage, drive it yourself: `sessionId` pins the conversation to
a known session (the server keeps LLM history per session id),
`initialItems` preloads the transcript, and `onItemsChange` reports every
change. `restoreChatItems` from `@bunny.net/agent-core` sanitizes a stored
transcript (drops malformed entries, marks interrupted tool calls).

Note the server currently holds conversation history in memory — after a
server restart a restored transcript still renders, but the agent starts
that session without prior context.

**Vue / vanilla:** use `@bunny.net/agent-core` directly — it's pure
TypeScript + fetch:

```ts
import { BunnyAgentClient, createSessionId, reduceChatItems } from "@bunny.net/agent-core";

const client = new BunnyAgentClient({ baseUrl: "https://agent.example.com" });
const sessionId = createSessionId();
let items = [];
await client.send(sessionId, "list my databases", (event) => {
  items = reduceChatItems(items, event); // render items in your framework
});
```

**Backend in your own app:** mount `@bunny.net/agent` anywhere that
speaks web-standard Request/Response:

```ts
import { createBunnyAgentHandler } from "@bunny.net/agent";
const agent = createBunnyAgentHandler();
app.post("/api/chat", (c) => agent.chat(c.req.raw)); // Hono
app.get("/api/status", () => agent.status());
```

## MCP server

Expose the same 41 tools to Claude Code / Claude Desktop:

```bash
claude mcp add bunny -- node /path/to/bunny-agent/packages/mcp/dist/index.js
```

## Tools (41)

| Product            | Tools                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| Account            | `get_account`                                                              |
| Databases (libSQL) | list/create/get/delete, `execute_sql`, tokens (create/revoke), statistics  |
| Storage            | list/create/delete zones, `get_storage_zone_credentials`                   |
| CDN pull zones     | list/create/delete, `purge_pull_zone_cache`                                |
| DNS                | list/create/get/delete zones, add/delete records                           |
| Edge Scripting     | list/create/get/delete scripts, deploy code, publish, set variables        |
| Magic Containers   | list/get/deploy/restart/delete apps                                        |
| Stream             | list/create/get/delete video libraries (with API keys), list/create videos |

Destructive tools are flagged (`destructive: true`); the agent's system prompt
requires explicit user confirmation before calling them, and the MCP server
surfaces `destructiveHint` annotations so clients can gate them too.
