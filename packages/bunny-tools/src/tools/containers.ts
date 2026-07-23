import type { components } from "@bunny.net/openapi-client/generated/magic-containers.d.ts";
import { defineTool } from "../registry.js";

type ContainerAppListItem = components["schemas"]["AppListItem"];
type ContainerAppDetail = components["schemas"]["Application"];
type ContainerAppOverview = components["schemas"]["Overview"];

const summarizeListItem = (app: ContainerAppListItem) => ({
  id: app.id,
  name: app.name,
  status: app.status,
  endpoint: app.displayEndpoint
    ? { address: app.displayEndpoint.address, type: app.displayEndpoint.type }
    : null,
});

export const listContainerApps = defineTool({
  name: "list_container_apps",
  description:
    "List all Bunny Magic Containers apps on the account with their IDs, names, statuses, and public endpoints.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  run: async (client) => {
    const apps = await client.mc<
      ContainerAppListItem[] | components["schemas"]["ListApplicationsResponse"]
    >("GET", "/apps");
    const list = Array.isArray(apps) ? apps : apps.items ?? [];
    return list.map(summarizeListItem);
  },
});

export const getContainerApp = defineTool({
  name: "get_container_app",
  description:
    "Get a Magic Containers app: status, runtime, regions, containers with images and endpoints. Set include_overview for live metrics (instances, latency, per-region status, monthly cost).",
  input_schema: {
    type: "object",
    properties: {
      app_id: { type: "string", description: "Magic Containers app ID" },
      include_overview: {
        type: "boolean",
        description: "Also fetch live metrics from the app overview (default false)",
      },
    },
    required: ["app_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const app = await client.mc<ContainerAppDetail>(
      "GET",
      `/apps/${input.app_id}`,
    );
    const summary = {
      id: app.id,
      name: app.name,
      status: app.status,
      runtime_type: app.runtimeType,
      endpoint: app.displayEndpoint
        ? { address: app.displayEndpoint.address, type: app.displayEndpoint.type }
        : null,
      regions: app.regionSettings
        ? {
            allowed: app.regionSettings.allowedRegionIds,
            required: app.regionSettings.requiredRegionIds,
            max_allowed: app.regionSettings.maxAllowedRegions,
            provisioning_type: app.regionSettings.provisioningType,
          }
        : null,
      containers: (app.containerTemplates ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        image: c.image,
        environment_variable_names: (c.environmentVariables ?? []).map(
          (v) => v.name,
        ),
        endpoints: (c.endpoints ?? []).map((e) => ({
          name: e.displayName,
          type: e.type,
          public_host: e.publicHost,
          ports: (e.portMappings ?? []).map((p) => ({
            container_port: p.containerPort,
            exposed_port: p.exposedPort,
            protocols: p.protocols,
          })),
        })),
      })),
    };

    if (!input.include_overview) return summary;

    const overview = await client.mc<ContainerAppOverview>(
      "GET",
      `/apps/${input.app_id}/overview`,
    );
    return {
      ...summary,
      overview: {
        desired_instances: overview.desiredInstances,
        average_latency_ms: overview.averageLatency,
        total_volume_size_gb: overview.totalVolumeSizeInGb,
        monthly_cost: overview.monthlyCost,
        regions: (overview.regions ?? []).map((r) => ({
          region: r.region,
          status: r.status,
          instances: r.instances,
          required: r.isRequired,
          average_cpu: r.averageCPU,
          average_ram: r.averageRAM,
          requests: r.requests,
        })),
      },
    };
  },
});

export const deployContainerApp = defineTool({
  name: "deploy_container_app",
  description:
    "Deploy a Magic Containers app, rolling out its current configuration to the assigned regions.",
  input_schema: {
    type: "object",
    properties: {
      app_id: { type: "string", description: "Magic Containers app ID to deploy" },
    },
    required: ["app_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.mc("POST", `/apps/${input.app_id}/deploy`);
    return { deployed: true, app_id: input.app_id };
  },
});

export const restartContainerApp = defineTool({
  name: "restart_container_app",
  description:
    "Restart all running instances of a Magic Containers app. Causes a brief interruption while containers restart.",
  input_schema: {
    type: "object",
    properties: {
      app_id: { type: "string", description: "Magic Containers app ID to restart" },
    },
    required: ["app_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.mc("POST", `/apps/${input.app_id}/restart`);
    return { restarted: true, app_id: input.app_id };
  },
});

export const deleteContainerApp = defineTool({
  name: "delete_container_app",
  description:
    "Permanently delete a Magic Containers app and stop all its instances. Irreversible. Only call after the user explicitly confirms deleting this specific app.",
  destructive: true,
  input_schema: {
    type: "object",
    properties: {
      app_id: { type: "string", description: "Magic Containers app ID to delete" },
    },
    required: ["app_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.mc("DELETE", `/apps/${input.app_id}`);
    return { deleted: true, app_id: input.app_id };
  },
});

export const containerTools = [
  listContainerApps,
  getContainerApp,
  deployContainerApp,
  restartContainerApp,
  deleteContainerApp,
];
