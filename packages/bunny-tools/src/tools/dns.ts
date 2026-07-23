import type { components } from "@bunny.net/openapi-client/generated/core.d.ts";
import { defineTool } from "../registry.js";

type DnsRecord = components["schemas"]["DnsRecordModel"];
type DnsZone = components["schemas"]["DnsZoneModel"];
type DnsRecordType = components["schemas"]["DnsRecordTypes"];

const RECORD_TYPES: Record<string, DnsRecordType> = {
  A: 0,
  AAAA: 1,
  CNAME: 2,
  TXT: 3,
  MX: 4,
  REDIRECT: 5,
  PULLZONE: 7,
  SRV: 8,
  CAA: 9,
  PTR: 10,
  SCRIPT: 11,
  NS: 12,
};

const RECORD_TYPE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(RECORD_TYPES).map(([name, id]) => [id, name]),
);

const summarizeRecord = (record: DnsRecord) => ({
  id: record.Id,
  type: RECORD_TYPE_NAMES[record.Type ?? -1] ?? `UNKNOWN(${record.Type})`,
  name: record.Name,
  value: record.Value,
  ttl: record.Ttl,
  priority: record.Priority,
  disabled: record.Disabled,
});

const summarizeZone = (zone: DnsZone) => ({
  id: zone.Id,
  domain: zone.Domain,
  nameservers: [zone.Nameserver1, zone.Nameserver2].filter(Boolean),
  dnssec_enabled: zone.DnsSecEnabled,
  record_count: (zone.Records ?? []).length,
});

export const listDnsZones = defineTool({
  name: "list_dns_zones",
  description:
    "List all Bunny DNS zones on the account with their IDs, domains, nameservers, and record counts. Use this to find a zone's ID before reading or modifying its records.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  run: async (client) => {
    const zones = await client.main<
      DnsZone[] | components["schemas"]["PaginationListModelOfDnsZoneModel"]
    >(
      "GET",
      "/dnszone?page=1&perPage=100",
    );
    const list = Array.isArray(zones) ? zones : zones.Items ?? [];
    return list.map(summarizeZone);
  },
});

export const createDnsZone = defineTool({
  name: "create_dns_zone",
  description:
    "Create a new Bunny DNS zone for a domain. Returns the zone ID and the Bunny nameservers the domain must be pointed at.",
  input_schema: {
    type: "object",
    properties: {
      domain: {
        type: "string",
        description: "Domain name to manage, e.g. example.com",
      },
    },
    required: ["domain"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const zone = await client.main<DnsZone>("POST", "/dnszone", {
      Domain: input.domain,
    });
    return summarizeZone(zone);
  },
});

export const getDnsZone = defineTool({
  name: "get_dns_zone",
  description:
    "Get a single DNS zone by ID, including all of its DNS records. Use this to inspect existing records before adding or deleting any.",
  input_schema: {
    type: "object",
    properties: {
      zone_id: { type: "number", description: "Numeric DNS zone ID" },
    },
    required: ["zone_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const zone = await client.main<DnsZone>("GET", `/dnszone/${input.zone_id}`);
    return {
      ...summarizeZone(zone),
      records: (zone.Records ?? []).map(summarizeRecord),
    };
  },
});

export const addDnsRecord = defineTool({
  name: "add_dns_record",
  description:
    "Add a DNS record (A, AAAA, CNAME, TXT, MX, SRV, CAA, PTR, NS, Redirect, PullZone, or Script) to an existing DNS zone. Use list_dns_zones or get_dns_zone first to find the zone ID.",
  input_schema: {
    type: "object",
    properties: {
      zone_id: { type: "number", description: "Numeric DNS zone ID" },
      type: {
        type: "string",
        enum: Object.keys(RECORD_TYPES),
        description: "Record type, e.g. A, CNAME, TXT",
      },
      name: {
        type: "string",
        description:
          "Record name relative to the zone, e.g. 'www' or '' for the apex",
      },
      value: {
        type: "string",
        description: "Record value, e.g. an IP address or target hostname",
      },
      ttl: {
        type: "number",
        description: "TTL in seconds (optional, defaults to the zone default)",
      },
    },
    required: ["zone_id", "type", "name", "value"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const typeId = RECORD_TYPES[String(input.type).toUpperCase()];
    if (typeId === undefined) {
      throw new Error(
        `Unknown record type "${input.type}". Supported: ${Object.keys(RECORD_TYPES).join(", ")}`,
      );
    }
    const record = await client.main<DnsRecord>(
      "PUT",
      `/dnszone/${input.zone_id}/records`,
      {
        Type: typeId,
        Name: input.name,
        Value: input.value,
        ...(input.ttl !== undefined ? { Ttl: input.ttl } : {}),
      },
    );
    return { zone_id: input.zone_id, ...summarizeRecord(record) };
  },
});

export const deleteDnsRecord = defineTool({
  name: "delete_dns_record",
  description:
    "Permanently delete a single DNS record from a zone. Irreversible. Use get_dns_zone first to find the record ID and confirm it is the right record.",
  destructive: true,
  input_schema: {
    type: "object",
    properties: {
      zone_id: { type: "number", description: "Numeric DNS zone ID" },
      record_id: { type: "number", description: "Numeric DNS record ID to delete" },
    },
    required: ["zone_id", "record_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.main(
      "DELETE",
      `/dnszone/${input.zone_id}/records/${input.record_id}`,
    );
    return { deleted: true, zone_id: input.zone_id, record_id: input.record_id };
  },
});

export const deleteDnsZone = defineTool({
  name: "delete_dns_zone",
  description:
    "Permanently delete an entire DNS zone and all of its records. Irreversible — only call after explicit user confirmation to delete this specific zone.",
  destructive: true,
  input_schema: {
    type: "object",
    properties: {
      zone_id: { type: "number", description: "Numeric DNS zone ID to delete" },
    },
    required: ["zone_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.main("DELETE", `/dnszone/${input.zone_id}`);
    return { deleted: true, zone_id: input.zone_id };
  },
});

export const dnsTools = [
  listDnsZones,
  createDnsZone,
  getDnsZone,
  addDnsRecord,
  deleteDnsRecord,
  deleteDnsZone,
];
