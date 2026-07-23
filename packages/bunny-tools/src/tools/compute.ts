import type { components } from "@bunny.net/openapi-client/generated/compute.d.ts";
import { defineTool } from "../registry.js";

type EdgeScript = components["schemas"]["EdgeScriptModel"];

const SCRIPT_TYPES: Record<number, string> = {
  0: "dns",
  1: "standalone",
  2: "middleware",
};

const summarize = (script: EdgeScript) => ({
  id: script.Id,
  name: script.Name,
  script_type: SCRIPT_TYPES[script.ScriptType ?? -1] ?? "unknown",
  published: (script.CurrentReleaseId ?? 0) > 0,
  hostname: script.DefaultHostname || script.SystemHostname || null,
  linked_pull_zones: (script.LinkedPullZones ?? []).map((z) => z.PullZoneName),
  variables: (script.EdgeScriptVariables ?? []).map((v) => ({
    id: v.Id,
    name: v.Name,
    value: v.DefaultValue,
  })),
  last_modified: script.LastModified,
});

export const listEdgeScripts = defineTool({
  name: "list_edge_scripts",
  description:
    "List all Bunny Edge Scripting (compute) scripts on the account with their IDs, names, types, hostnames, and variables.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  run: async (client) => {
    const scripts = await client.main<
      components["schemas"]["PaginationListModelOfEdgeScriptModel"] | EdgeScript[]
    >(
      "GET",
      "/compute/script?page=1&perPage=100",
    );
    const list = Array.isArray(scripts) ? scripts : scripts.Items ?? [];
    return list.map(summarize);
  },
});

export const createEdgeScript = defineTool({
  name: "create_edge_script",
  description:
    "Create a new Bunny Edge Script. Type 'standalone' serves requests directly on its own hostname; 'middleware' runs in front of a pull zone's origin. After creating, deploy code with update_edge_script_code.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name for the new edge script",
      },
      script_type: {
        type: "string",
        enum: ["standalone", "middleware"],
        description: "Script type: standalone (own endpoint) or middleware (attached to a pull zone)",
      },
      create_linked_pull_zone: {
        type: "boolean",
        description: "Also create a linked pull zone so the script gets a public *.b-cdn.net hostname (default false)",
      },
    },
    required: ["name", "script_type"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const script = await client.main<EdgeScript>("POST", "/compute/script", {
      Name: input.name,
      ScriptType: input.script_type === "middleware" ? 2 : 1,
      CreateLinkedPullZone: input.create_linked_pull_zone ?? false,
    });
    return summarize(script);
  },
});

export const getEdgeScript = defineTool({
  name: "get_edge_script",
  description:
    "Get details of a single edge script by ID, including its type, hostname, publish state, and environment variables.",
  input_schema: {
    type: "object",
    properties: {
      script_id: { type: "number", description: "Numeric edge script ID" },
    },
    required: ["script_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const script = await client.main<EdgeScript>(
      "GET",
      `/compute/script/${input.script_id}`,
    );
    return summarize(script);
  },
});

export const updateEdgeScriptCode = defineTool({
  name: "update_edge_script_code",
  description:
    "Upload JavaScript/TypeScript code to an edge script, deploying it to Bunny's edge network. The code should export a fetch handler (e.g. via BunnySDK). Changes only go live after publish_edge_script is called.",
  input_schema: {
    type: "object",
    properties: {
      script_id: { type: "number", description: "Numeric edge script ID" },
      code: {
        type: "string",
        description: "Full JavaScript/TypeScript source code for the script",
      },
    },
    required: ["script_id", "code"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.main("POST", `/compute/script/${input.script_id}/code`, {
      Code: input.code,
    });
    return { uploaded: true, script_id: input.script_id };
  },
});

export const publishEdgeScript = defineTool({
  name: "publish_edge_script",
  description:
    "Publish the latest uploaded code of an edge script, making it live on the edge network.",
  input_schema: {
    type: "object",
    properties: {
      script_id: { type: "number", description: "Numeric edge script ID" },
    },
    required: ["script_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.main("POST", `/compute/script/${input.script_id}/publish`, {});
    return { published: true, script_id: input.script_id };
  },
});

export const deleteEdgeScript = defineTool({
  name: "delete_edge_script",
  description:
    "Permanently delete an edge script and its deployments. Irreversible. Only call after the user explicitly confirms deleting this specific script.",
  destructive: true,
  input_schema: {
    type: "object",
    properties: {
      script_id: { type: "number", description: "Numeric edge script ID to delete" },
    },
    required: ["script_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.main("DELETE", `/compute/script/${input.script_id}`);
    return { deleted: true, script_id: input.script_id };
  },
});

export const setEdgeScriptVariable = defineTool({
  name: "set_edge_script_variable",
  description:
    "Create or update an environment variable on an edge script. The variable becomes available to the script's code after the next publish.",
  input_schema: {
    type: "object",
    properties: {
      script_id: { type: "number", description: "Numeric edge script ID" },
      name: { type: "string", description: "Variable name, e.g. API_URL" },
      value: { type: "string", description: "Variable value" },
    },
    required: ["script_id", "name", "value"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.main("PUT", `/compute/script/${input.script_id}/variables`, {
      Name: input.name,
      DefaultValue: input.value,
    });
    return { set: true, script_id: input.script_id, name: input.name };
  },
});

export const computeTools = [
  listEdgeScripts,
  createEdgeScript,
  getEdgeScript,
  updateEdgeScriptCode,
  publishEdgeScript,
  deleteEdgeScript,
  setEdgeScriptVariable,
];
