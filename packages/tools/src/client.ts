import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MAIN_API = "https://api.bunny.net";
const DATABASE_API = "https://api.bunny.net/database";
const MC_API = "https://api.bunny.net/mc";

export class BunnyApiError extends Error {
  constructor(
    public status: number,
    public method: string,
    public path: string,
    public body: string,
  ) {
    super(`Bunny API ${method} ${path} failed with ${status}: ${body}`);
  }
}

/**
 * Resolves the Bunny API key from (in order): explicit argument,
 * BUNNY_API_KEY / BUNNYNET_API_KEY env vars, or the bunny CLI's
 * default profile on disk (~/.config/bunnynet.json).
 */
export function resolveApiKey(explicit?: string): string {
  if (explicit) return explicit;
  const fromEnv = process.env.BUNNY_API_KEY ?? process.env.BUNNYNET_API_KEY;
  if (fromEnv) return fromEnv;

  const candidates = [
    process.env.XDG_CONFIG_HOME &&
      join(process.env.XDG_CONFIG_HOME, "bunnynet.json"),
    join(homedir(), ".config", "bunnynet.json"),
    join(homedir(), ".bunnynet.json"),
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    try {
      const config = JSON.parse(readFileSync(file, "utf8"));
      const key = config?.profiles?.default?.api_key;
      if (key) return key;
    } catch {
      // missing or unparsable config — try the next location
    }
  }

  throw new Error(
    "No Bunny API key found. Set BUNNY_API_KEY, or run `bunny login`.",
  );
}

export class BunnyClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = resolveApiKey(apiKey);
  }

  private async request<T>(
    base: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        AccessKey: this.apiKey,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BunnyApiError(res.status, method, path, text.slice(0, 2000));
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  /** Requests against https://api.bunny.net (storage, pull zones, DNS, user…) */
  main<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.request<T>(MAIN_API, method, path, body);
  }

  /** Requests against https://api.bunny.net/database (Bunny databases v2 API) */
  database<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.request<T>(DATABASE_API, method, path, body);
  }

  /** Requests against https://api.bunny.net/mc (Magic Containers API) */
  mc<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.request<T>(MC_API, method, path, body);
  }
}
