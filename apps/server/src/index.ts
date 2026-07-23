import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createBunnyAgentHandler } from "@bunny-agent/handler";
import { Hono } from "hono";
import { cors } from "hono/cors";

const agent = createBunnyAgentHandler();

const app = new Hono();
app.use("/api/*", cors());
app.get("/api/status", () => agent.status());
app.post("/api/chat", (c) => agent.chat(c.req.raw));

const here = dirname(fileURLToPath(import.meta.url));
const webDist = join(here, "..", "..", "web", "dist");
if (existsSync(webDist)) {
  app.use("*", serveStatic({ root: webDist }));
  app.use("*", serveStatic({ root: webDist, path: "index.html" }));
}

const port = Number(process.env.AGENT_PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`bunny-agent server listening on http://localhost:${info.port}`);
});
