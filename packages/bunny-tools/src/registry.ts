import type { BunnyClient } from "./client.js";

/**
 * A single agent tool. The same definition drives both the Claude API
 * `tools` array and the MCP server's tool listing, so every surface
 * (dashboard widget, standalone page, MCP client) gets identical behavior.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  /**
   * Destructive tools (deletes, token revocation) are flagged so hosts can
   * require user confirmation before running them.
   */
  destructive?: boolean;
  run: (client: BunnyClient, input: Record<string, any>) => Promise<unknown>;
}

export function defineTool(tool: ToolDefinition): ToolDefinition {
  return tool;
}
