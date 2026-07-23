import type { components } from "@bunny.net/openapi-client/generated/core.d.ts";
import { defineTool } from "../registry.js";

type PullZone = components["schemas"]["PullZoneModel"];

const summarize = (zone: PullZone) => ({
  id: zone.Id,
  name: zone.Name,
  origin_url: zone.OriginUrl || null,
  storage_zone_id:
    zone.StorageZoneId && zone.StorageZoneId > 0 ? zone.StorageZoneId : null,
  enabled: zone.Enabled,
  hostnames: (zone.Hostnames ?? []).map((h) => h.Value),
  monthly_bandwidth_used_bytes: zone.MonthlyBandwidthUsed,
});

export const listPullZones = defineTool({
  name: "list_pull_zones",
  description:
    "List all Bunny CDN pull zones on the account with their IDs, names, origins, and hostnames.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  run: async (client) => {
    const zones = await client.main<PullZone[] | { Items: PullZone[] }>(
      "GET",
      "/pullzone?page=1&perPage=100",
    );
    const list = Array.isArray(zones) ? zones : (zones.Items ?? []);
    return list.map(summarize);
  },
});

export const createPullZone = defineTool({
  name: "create_pull_zone",
  description:
    "Create a new Bunny CDN pull zone. Provide either an origin_url (proxy an existing site) or a storage_zone_id (serve files from a Bunny storage zone). Returns the CDN hostname (name.b-cdn.net).",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Globally unique pull zone name — becomes <name>.b-cdn.net",
      },
      origin_url: {
        type: "string",
        description:
          "Origin URL to pull content from, e.g. https://example.com",
      },
      storage_zone_id: {
        type: "number",
        description:
          "Storage zone ID to serve files from (instead of an origin URL)",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    if (!input.origin_url && !input.storage_zone_id) {
      throw new Error("Provide either origin_url or storage_zone_id");
    }
    const zone = await client.main<PullZone>("POST", "/pullzone", {
      Name: input.name,
      ...(input.origin_url ? { OriginUrl: input.origin_url } : {}),
      ...(input.storage_zone_id
        ? { StorageZoneId: input.storage_zone_id }
        : {}),
    });
    return { ...summarize(zone), cdn_url: `https://${input.name}.b-cdn.net` };
  },
});

export const deletePullZone = defineTool({
  name: "delete_pull_zone",
  description:
    "Permanently delete a pull zone. Irreversible. Only call after the user explicitly confirms deleting this specific zone.",
  destructive: true,
  input_schema: {
    type: "object",
    properties: {
      pull_zone_id: {
        type: "number",
        description: "Numeric pull zone ID to delete",
      },
    },
    required: ["pull_zone_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.main("DELETE", `/pullzone/${input.pull_zone_id}`);
    return { deleted: true, pull_zone_id: input.pull_zone_id };
  },
});

export const purgePullZoneCache = defineTool({
  name: "purge_pull_zone_cache",
  description: "Purge the full CDN cache of a pull zone.",
  input_schema: {
    type: "object",
    properties: {
      pull_zone_id: { type: "number", description: "Numeric pull zone ID" },
    },
    required: ["pull_zone_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.main("POST", `/pullzone/${input.pull_zone_id}/purgeCache`, {});
    return { purged: true, pull_zone_id: input.pull_zone_id };
  },
});

export const pullZoneTools = [
  listPullZones,
  createPullZone,
  deletePullZone,
  purgePullZoneCache,
];
