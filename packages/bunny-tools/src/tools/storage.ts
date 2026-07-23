import type { components } from "@bunny.net/openapi-client/generated/core.d.ts";
import { defineTool } from "../registry.js";

type StorageZone = components["schemas"]["StorageZoneModel"];

function storageHostname(region: string | null | undefined): string {
  // DE ("Falkenstein") is the main endpoint; other regions are prefixed.
  return region && region.toUpperCase() !== "DE"
    ? `${region.toLowerCase()}.storage.bunnycdn.com`
    : "storage.bunnycdn.com";
}

const summarize = (zone: StorageZone) => ({
  id: zone.Id,
  name: zone.Name,
  region: zone.Region,
  replication_regions: zone.ReplicationRegions,
  hostname: storageHostname(zone.Region),
  storage_used_bytes: zone.StorageUsed,
  files_stored: zone.FilesStored,
});

export const listStorageZones = defineTool({
  name: "list_storage_zones",
  description:
    "List all Bunny storage zones on the account with their IDs, names, regions, and usage. Does not include credentials — use get_storage_zone_credentials for those.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  run: async (client) => {
    // The spec types this as a plain array; with page>0 the API actually
    // returns a paginated { Items } wrapper it doesn't model.
    const zones = await client.main<StorageZone[] | { Items?: StorageZone[] | null }>(
      "GET",
      "/storagezone?page=1&perPage=100",
    );
    const list = Array.isArray(zones) ? zones : zones.Items ?? [];
    return list.map(summarize);
  },
});

export const createStorageZone = defineTool({
  name: "create_storage_zone",
  description:
    "Create a new Bunny storage zone (object/file storage). Returns the zone details including its access credentials (password = the storage API access key). Region codes: DE (Falkenstein, default), NY, LA, SG, SYD, UK, SE, BR, JH.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Globally unique storage zone name (lowercase alphanumeric and dashes)",
      },
      region: {
        type: "string",
        description: "Main storage region code. Defaults to DE.",
      },
      replication_regions: {
        type: "array",
        items: { type: "string" },
        description: "Optional replica region codes for geo-replication.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const zone = await client.main<StorageZone>("POST", "/storagezone", {
      Name: input.name,
      Region: input.region ?? "DE",
      ...(input.replication_regions?.length
        ? { ReplicationRegions: input.replication_regions }
        : {}),
    });
    return {
      ...summarize(zone),
      credentials: {
        hostname: storageHostname(zone.Region),
        username: zone.Name,
        password: zone.Password,
        read_only_password: zone.ReadOnlyPassword,
        api_example: `curl -H "AccessKey: ${zone.Password}" https://${storageHostname(zone.Region)}/${zone.Name}/`,
      },
    };
  },
});

export const getStorageZoneCredentials = defineTool({
  name: "get_storage_zone_credentials",
  description:
    "Get connection credentials for an existing storage zone: hostname, username (zone name), full-access password/API key, and read-only password.",
  input_schema: {
    type: "object",
    properties: {
      storage_zone_id: { type: "number", description: "Numeric storage zone ID" },
    },
    required: ["storage_zone_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const zone = await client.main<StorageZone>(
      "GET",
      `/storagezone/${input.storage_zone_id}`,
    );
    return {
      id: zone.Id,
      name: zone.Name,
      hostname: storageHostname(zone.Region),
      username: zone.Name,
      password: zone.Password,
      read_only_password: zone.ReadOnlyPassword,
    };
  },
});

export const deleteStorageZone = defineTool({
  name: "delete_storage_zone",
  description:
    "Permanently delete a storage zone and all files in it. Irreversible. Only call after the user explicitly confirms deleting this specific zone.",
  destructive: true,
  input_schema: {
    type: "object",
    properties: {
      storage_zone_id: { type: "number", description: "Numeric storage zone ID to delete" },
    },
    required: ["storage_zone_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.main("DELETE", `/storagezone/${input.storage_zone_id}`);
    return { deleted: true, storage_zone_id: input.storage_zone_id };
  },
});

export const storageTools = [
  listStorageZones,
  createStorageZone,
  getStorageZoneCredentials,
  deleteStorageZone,
];
