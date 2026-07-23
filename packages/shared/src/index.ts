/**
 * @bunny.net/agent-shared — the wire contract between the backend handler and
 * every frontend. No dependencies; safe to import anywhere (server, browser,
 * React, Angular, MCP glue).
 */

/** Events streamed from the agent handler over SSE during a turn. */
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string; input: unknown }
  | {
      type: "tool_end";
      name: string;
      ok: boolean;
      input: unknown;
      /** The tool's return value when ok — e.g. the created resource's id/summary. */
      result?: unknown;
      error?: string;
    }
  | { type: "ui"; block: UIBlock }
  | { type: "done" }
  | { type: "error"; message: string };

/** A clickable follow-up: clicking sends `message` as the user's next turn. */
export interface UIAction {
  /** Button label shown to the user. */
  label: string;
  /** Message sent when clicked; defaults to the label. */
  message?: string;
  /** Visual emphasis; "destructive" for delete/cleanup flows. */
  variant?: "default" | "outline" | "destructive";
}

/** One option in a choices block. */
export interface UIChoice {
  /** Option label shown to the user. */
  label: string;
  /** Value interpolated into the composed message; defaults to the label. */
  value?: string;
  /** Optional secondary line under the label. */
  description?: string;
}

/** One plotted series in a chart block. */
export interface UIChartSeries {
  /** Key in each data row holding this series' numeric value. */
  key: string;
  /** Legend/tooltip label; defaults to the key. */
  label?: string;
}

/**
 * Rich UI rendered inline in the transcript. Emitted by the handler when the
 * model calls one of the UI tools (suggest_actions, ask_choices, show_chart);
 * frontends render them as interactive components instead of prose.
 */
export type UIBlock =
  | {
      type: "actions";
      /** Optional lead-in line shown above the buttons. */
      prompt?: string;
      actions: UIAction[];
    }
  | {
      type: "choices";
      /** Question shown above the options. */
      prompt: string;
      /** Allow picking several options (checkboxes instead of radios). */
      multi?: boolean;
      choices: UIChoice[];
      /** Submit button label; defaults to "Send". */
      submitLabel?: string;
      /**
       * Composed message template; "{selection}" is replaced with the chosen
       * values (comma-joined). Defaults to "{selection}".
       */
      messageTemplate?: string;
    }
  | {
      type: "chart";
      kind: "line" | "area" | "bar";
      title?: string;
      /** Key in each data row holding the x-axis label (e.g. a date). */
      xKey: string;
      series: UIChartSeries[];
      data: Array<Record<string, string | number>>;
      /** Unit suffix for values, e.g. "GB" or "requests". */
      unit?: string;
    };

/** Payload passed to onToolSuccess callbacks (handler options, client options, React props). */
export interface ToolSuccessEvent {
  /** Tool name, e.g. "create_pull_zone". */
  name: string;
  /** The input the model invoked the tool with. */
  input: unknown;
  /** The tool's return value — e.g. the created resource's id/summary. */
  result: unknown;
}

/** Payload passed to onToolError callbacks (handler options, client options, React props). */
export interface ToolErrorEvent {
  /** Tool name, e.g. "create_pull_zone". */
  name: string;
  /** The input the model invoked the tool with. */
  input: unknown;
  error: string;
}

/** Response shape of GET /api/status. */
export interface AgentStatus {
  bunny: { configured: boolean; email?: string };
  openrouter: { configured: boolean };
}

/** Request body of POST /api/chat. */
export interface ChatRequestBody {
  sessionId: string;
  message: string;
}
