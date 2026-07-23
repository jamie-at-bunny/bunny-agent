/**
 * @bunny.net/agent-core — framework-agnostic frontend core for the Bunny Agent.
 * Pure TypeScript + fetch: usable from React, Angular, Vue, Svelte, web
 * components, or plain scripts. Pair with `@bunny.net/agent-core/styles.css`
 * (or your own stylesheet) for the look.
 */
import type {
  AgentEvent,
  AgentStatus,
  ToolErrorEvent,
  ToolSuccessEvent,
  UIBlock,
} from "@bunny.net/agent-shared";

export type {
  AgentEvent,
  AgentStatus,
  ToolErrorEvent,
  ToolSuccessEvent,
  UIAction,
  UIBlock,
  UIChartSeries,
  UIChoice,
} from "@bunny.net/agent-shared";

export interface BunnyAgentClientOptions {
  /** Origin of the agent server, e.g. "https://agent.bunny.net". Defaults to same-origin. */
  baseUrl?: string;
  /** Custom fetch implementation (tests, SSR, interceptors). */
  fetch?: typeof fetch;
  /**
   * Called whenever the agent runs a tool successfully, with the tool's
   * result — e.g. redirect to a resource page after `create_pull_zone`.
   */
  onToolSuccess?: (event: ToolSuccessEvent) => void;
  /** Called whenever a tool run fails. */
  onToolError?: (event: ToolErrorEvent) => void;
}

const DEV_MODE_STORAGE_KEY = "bunny-agent:dev";

export class BunnyAgentClient {
  readonly baseUrl: string;
  private fetchImpl: typeof fetch;
  private onToolSuccess?: (event: ToolSuccessEvent) => void;
  private onToolError?: (event: ToolErrorEvent) => void;
  private devModeValue = false;
  private devModeListeners = new Set<() => void>();

  constructor(options: BunnyAgentClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "").replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch.bind(globalThis);
    this.onToolSuccess = options.onToolSuccess;
    this.onToolError = options.onToolError;
    try {
      this.devModeValue =
        typeof localStorage !== "undefined" &&
        localStorage.getItem(DEV_MODE_STORAGE_KEY) === "1";
    } catch {
      // storage unavailable (SSR, sandboxed iframe) — default off
    }
  }

  /**
   * Developer mode: when on, UIs show detailed tool-call activity instead of
   * the quiet status markers. Toggle it from the browser console via the
   * instance exposed by the UI wrappers:
   *
   *   __bunnyAgent.devMode = true
   *
   * The value persists in localStorage across reloads.
   */
  get devMode(): boolean {
    return this.devModeValue;
  }

  set devMode(value: boolean) {
    if (value === this.devModeValue) return;
    this.devModeValue = value;
    try {
      if (typeof localStorage !== "undefined") {
        if (value) localStorage.setItem(DEV_MODE_STORAGE_KEY, "1");
        else localStorage.removeItem(DEV_MODE_STORAGE_KEY);
      }
    } catch {
      // best-effort persistence only
    }
    for (const listener of this.devModeListeners) listener();
  }

  /** Subscribe to devMode changes. Returns an unsubscribe function. */
  onDevModeChange(listener: () => void): () => void {
    this.devModeListeners.add(listener);
    return () => this.devModeListeners.delete(listener);
  }

  async status(): Promise<AgentStatus> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/status`);
    if (!res.ok) throw new Error(`status request failed (${res.status})`);
    return res.json();
  }

  /**
   * Send one user message and stream back agent events (text deltas, tool
   * activity). Resolves when the turn is complete. Abort via `signal`.
   */
  async send(
    sessionId: string,
    message: string,
    onEvent: (event: AgentEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
      signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(
        (body as { error?: string } | null)?.error ??
          `Request failed (${res.status})`,
      );
    }
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary === -1) break;
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = chunk
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        const event = JSON.parse(dataLine.slice(6)) as AgentEvent;
        this.dispatchToolCallbacks(event);
        onEvent(event);
      }
    }
  }

  private dispatchToolCallbacks(event: AgentEvent): void {
    if (event.type !== "tool_end") return;
    if (event.ok) {
      this.onToolSuccess?.({
        name: event.name,
        input: event.input,
        result: event.result,
      });
    } else {
      this.onToolError?.({
        name: event.name,
        input: event.input,
        error: event.error ?? "Unknown error",
      });
    }
  }
}

export function createSessionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Chat transcript reducer — shared by every UI wrapper so React/Angular/etc.
 * render identical transcripts from the same event stream.
 */
export type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | {
      kind: "tool";
      name: string;
      status: "running" | "ok" | "error";
      error?: string;
    }
  | { kind: "ui"; block: UIBlock };

export function reduceChatItems(
  items: ChatItem[],
  event: AgentEvent,
): ChatItem[] {
  const next = [...items];
  if (event.type === "text") {
    const last = next[next.length - 1];
    if (last?.kind === "assistant") {
      next[next.length - 1] = { ...last, text: last.text + event.text };
    } else {
      next.push({ kind: "assistant", text: event.text });
    }
  } else if (event.type === "tool_start") {
    next.push({ kind: "tool", name: event.name, status: "running" });
  } else if (event.type === "tool_end") {
    for (let i = next.length - 1; i >= 0; i--) {
      const item = next[i];
      if (
        item.kind === "tool" &&
        item.name === event.name &&
        item.status === "running"
      ) {
        next[i] = {
          ...item,
          status: event.ok ? "ok" : "error",
          error: event.error,
        };
        break;
      }
    }
  } else if (event.type === "ui") {
    next.push({ kind: "ui", block: event.block });
  } else if (event.type === "error") {
    next.push({ kind: "assistant", text: `⚠️ ${event.message}` });
  }
  return next;
}

/**
 * Prepare a persisted transcript for rendering. Tool calls that were still
 * running when the transcript was saved can never complete, so they are
 * marked as interrupted; malformed entries are dropped.
 */
export function restoreChatItems(items: unknown): ChatItem[] {
  if (!Array.isArray(items)) return [];
  const restored: ChatItem[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as ChatItem;
    if (
      (candidate.kind === "user" || candidate.kind === "assistant") &&
      typeof candidate.text === "string"
    ) {
      restored.push({ kind: candidate.kind, text: candidate.text });
    } else if (
      candidate.kind === "tool" &&
      typeof candidate.name === "string"
    ) {
      restored.push(
        candidate.status === "running"
          ? { ...candidate, status: "error", error: "Interrupted" }
          : candidate,
      );
    } else if (
      candidate.kind === "ui" &&
      typeof candidate.block === "object" &&
      candidate.block !== null &&
      ["actions", "choices", "chart"].includes(
        (candidate.block as UIBlock).type,
      )
    ) {
      restored.push({ kind: "ui", block: candidate.block });
    }
  }
  return restored;
}
