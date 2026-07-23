// The /web build is pure fetch (no native bindings) — bundles cleanly in
// Next.js and works fine in Node since we only connect over HTTPS.
import { createClient } from "@libsql/client/web";
import type { components } from "@bunny.net/openapi-client/generated/database.d.ts";
import { defineTool } from "../registry.js";

type DatabaseRecord = components["schemas"]["Database2"];

/** Convert the API's libsql:// URL to the HTTPS endpoint @libsql/client uses over fetch. */
function toHttpsUrl(url: string): string {
  return url.replace(/^libsql:\/\//, "https://").replace(/\/$/, "");
}

export const listDatabases = defineTool({
  name: "list_databases",
  description:
    "List all Bunny databases on the account, including their IDs, names, connection URLs, regions, and sizes.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  run: async (client) => {
    const data = await client.database<components["schemas"]["ListDatabaseV2Response"]>(
      "GET",
      "/v2/databases?page=1&per_page=100",
    );
    return data.databases.map((db) => ({
      id: db.id,
      name: db.name,
      url: db.url,
      storage_region: db.storage_region,
      primary_regions: db.primary_regions,
      replicas_regions: db.replicas_regions,
      current_size: db.current_size,
      size_max: db.size_max,
    }));
  },
});

export const createDatabase = defineTool({
  name: "create_database",
  description:
    "Create a new Bunny database (libSQL/SQLite-compatible, globally replicated). Returns the database ID and connection URL. Region IDs are short codes like FR, DE, UK, NY. If the user doesn't specify regions, omit them to use defaults.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Database name (lowercase, hyphens allowed)" },
      primary_regions: {
        type: "array",
        items: { type: "string" },
        description: "Primary region IDs, e.g. [\"FR\", \"DE\"]. Optional.",
      },
      replicas_regions: {
        type: "array",
        items: { type: "string" },
        description: "Read-replica region IDs, e.g. [\"UK\", \"NY\"]. Optional.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const body: Record<string, unknown> = { name: input.name };
    if (input.primary_regions?.length) body.primary_regions = input.primary_regions;
    if (input.replicas_regions?.length) body.replicas_regions = input.replicas_regions;
    return client.database<components["schemas"]["CreateDatabaseV2Response"]>(
      "POST",
      "/v2/databases",
      body,
    );
  },
});

export const getDatabase = defineTool({
  name: "get_database",
  description: "Get details for a single Bunny database by its ID (db_...).",
  input_schema: {
    type: "object",
    properties: {
      database_id: { type: "string", description: "Database ID, e.g. db_01ABC..." },
    },
    required: ["database_id"],
    additionalProperties: false,
  },
  run: (client, input) =>
    client.database<components["schemas"]["ReadDatabaseV2Response"]>(
      "GET",
      `/v2/databases/${encodeURIComponent(input.database_id)}`,
    ),
});

export const deleteDatabase = defineTool({
  name: "delete_database",
  description:
    "Permanently delete a Bunny database and all its data. Irreversible. Only call this after the user has explicitly confirmed the deletion of this specific database.",
  destructive: true,
  input_schema: {
    type: "object",
    properties: {
      database_id: { type: "string", description: "Database ID to delete" },
    },
    required: ["database_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.database(
      "DELETE",
      `/v2/databases/${encodeURIComponent(input.database_id)}`,
    );
    return { deleted: true, database_id: input.database_id };
  },
});

export const createDatabaseToken = defineTool({
  name: "create_database_token",
  description:
    "Generate an auth token for a Bunny database so an application can connect to it. Returns the token — present it to the user together with the database URL as connection credentials.",
  input_schema: {
    type: "object",
    properties: {
      database_id: { type: "string", description: "Database ID" },
      authorization: {
        type: "string",
        enum: ["full-access", "read-only"],
        description: "Token permission level. Defaults to full-access.",
      },
      expires_in_minutes: {
        type: "number",
        description: "Optional expiry in minutes. Omit for a non-expiring token.",
      },
    },
    required: ["database_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const expiresAt = input.expires_in_minutes
      ? new Date(Date.now() + input.expires_in_minutes * 60_000).toISOString()
      : null;
    return client.database<components["schemas"]["GenerateTokenDatabaseV2Response"]>(
      "PUT",
      `/v2/databases/${encodeURIComponent(input.database_id)}/auth/generate`,
      { authorization: input.authorization ?? "full-access", expires_at: expiresAt },
    );
  },
});

export const revokeDatabaseTokens = defineTool({
  name: "revoke_database_tokens",
  description:
    "Invalidate ALL auth tokens for a database. Any application using an existing token will lose access. Only call after explicit user confirmation.",
  destructive: true,
  input_schema: {
    type: "object",
    properties: {
      database_id: { type: "string", description: "Database ID" },
    },
    required: ["database_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.database(
      "POST",
      `/v2/databases/${encodeURIComponent(input.database_id)}/auth/revoke`,
    );
    return { revoked: true, database_id: input.database_id };
  },
});

export const executeSql = defineTool({
  name: "execute_sql",
  description:
    "Execute SQL statements against a Bunny database (SQLite dialect). Use this to create tables/schemas, insert data, and run queries. Multiple statements can be separated by semicolons. Returns rows for SELECTs and affected-row counts for writes.",
  input_schema: {
    type: "object",
    properties: {
      database_id: { type: "string", description: "Database ID to run the SQL against" },
      sql: {
        type: "string",
        description: "SQL to execute (SQLite dialect). Semicolon-separated statements run in order.",
      },
    },
    required: ["database_id", "sql"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    // Spec says { db }, but stay tolerant of the record coming back unwrapped.
    const db = await client.database<
      components["schemas"]["ReadDatabaseV2Response"] | DatabaseRecord
    >("GET", `/v2/databases/${encodeURIComponent(input.database_id)}`);
    const record = "db" in db ? db.db : db;
    if (!record?.url) throw new Error(`Database ${input.database_id} has no connection URL`);

    // Short-lived token scoped to this execution. Spec says { token }, but
    // stay tolerant of the older auth_token / jwt field names.
    const tokenRes = await client.database<
      Partial<components["schemas"]["GenerateTokenDatabaseV2Response"]> &
        Record<string, any>
    >(
      "PUT",
      `/v2/databases/${encodeURIComponent(input.database_id)}/auth/generate`,
      {
        authorization: "full-access",
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
    );
    const token = tokenRes.token ?? tokenRes.auth_token ?? tokenRes.jwt;
    if (!token) throw new Error("Failed to generate a database auth token");

    const libsql = createClient({ url: toHttpsUrl(record.url), authToken: token });
    try {
      const statements = splitStatements(input.sql);
      const results = [];
      for (const statement of statements) {
        const res = await libsql.execute(statement);
        results.push({
          statement: statement.length > 120 ? statement.slice(0, 120) + "…" : statement,
          rows: res.rows.slice(0, 100),
          rows_returned: res.rows.length,
          rows_affected: res.rowsAffected,
        });
      }
      return { database_id: input.database_id, results };
    } finally {
      libsql.close();
    }
  },
});

/** Naive semicolon splitter that respects quoted strings — good enough for DDL/DML. */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      current += ch;
      if (ch === quote && sql[i + 1] === quote) {
        current += sql[++i]; // escaped quote
      } else if (ch === quote) {
        quote = null;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
    } else if (ch === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export const getDatabaseStatistics = defineTool({
  name: "get_database_statistics",
  description: "Get usage statistics for a Bunny database (reads, writes, storage).",
  input_schema: {
    type: "object",
    properties: {
      database_id: { type: "string", description: "Database ID" },
    },
    required: ["database_id"],
    additionalProperties: false,
  },
  run: (client, input) =>
    client.database<components["schemas"]["StatsDatabaseV2Response"]>(
      "GET",
      `/v2/databases/${encodeURIComponent(input.database_id)}/statistics`,
    ),
});

export const databaseTools = [
  listDatabases,
  createDatabase,
  getDatabase,
  deleteDatabase,
  createDatabaseToken,
  revokeDatabaseTokens,
  executeSql,
  getDatabaseStatistics,
];
