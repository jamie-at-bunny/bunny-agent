#!/usr/bin/env node
/**
 * Bunny MCP server — exposes the Bunny Agent tool registry over the
 * Model Context Protocol (stdio), so Claude Code / Claude Desktop /
 * any MCP client can manage bunny.net resources.
 *
 * Auth: BUNNY_API_KEY env var, or the bunny CLI's default profile.
 */
import { allTools, BunnyClient, toolsByName } from "@bunny.net/agent-tools";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "bunny-agent", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input_schema,
    annotations: {
      destructiveHint: tool.destructive ?? false,
      readOnlyHint:
        tool.name.startsWith("list_") || tool.name.startsWith("get_"),
    },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = toolsByName.get(request.params.name);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }
  try {
    const client = new BunnyClient();
    const result = await tool.run(
      client,
      (request.params.arguments ?? {}) as Record<string, any>,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`bunny-agent MCP server running (${allTools.length} tools)`);
