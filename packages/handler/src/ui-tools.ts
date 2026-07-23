/**
 * UI tools — tools the model calls to render interactive components in the
 * chat instead of prose. They never touch the Bunny API: the handler
 * intercepts them, validates the input into a UIBlock, and emits it as a
 * `ui` event on the SSE stream for the frontend to render.
 */
import type { UIAction, UIBlock, UIChartSeries, UIChoice } from "@bunny-agent/shared";

export interface UIToolSpec {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

const MAX_ACTIONS = 6;
const MAX_CHOICES = 12;
const MAX_SERIES = 6;
const MAX_ROWS = 500;

export const uiTools: UIToolSpec[] = [
  {
    name: "suggest_actions",
    description:
      'Offer the user clickable follow-up buttons rendered inline in the chat. Each button sends its message as the user\'s next turn when clicked. Use this INSTEAD of ending a reply with a text list of options ("Want me to: A, B, or C?"). Keep labels short (2-5 words).',
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Optional short lead-in shown above the buttons.",
        },
        actions: {
          type: "array",
          description: `1-${MAX_ACTIONS} buttons.`,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Button label." },
              message: {
                type: "string",
                description:
                  "Message sent when clicked; defaults to the label. Write it as the user would (imperative, self-contained).",
              },
              variant: {
                type: "string",
                enum: ["default", "outline", "destructive"],
                description:
                  'Visual emphasis; use "destructive" for delete/cleanup flows.',
              },
            },
            required: ["label"],
          },
        },
      },
      required: ["actions"],
    },
  },
  {
    name: "ask_choices",
    description:
      "Ask the user to pick from options via checkboxes (multi) or radio buttons (single) with a submit button, rendered inline in the chat. Use when a follow-up needs parameters — e.g. which categories to filter by, which regions to deploy to. Submitting sends the composed message as the user's next turn.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Question shown above the options." },
        multi: {
          type: "boolean",
          description: "Allow selecting several options. Defaults to false.",
        },
        choices: {
          type: "array",
          description: `2-${MAX_CHOICES} options.`,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Option label." },
              value: {
                type: "string",
                description:
                  "Value interpolated into the composed message; defaults to the label.",
              },
              description: {
                type: "string",
                description: "Optional secondary line under the label.",
              },
            },
            required: ["label"],
          },
        },
        submit_label: {
          type: "string",
          description: 'Submit button label. Defaults to "Send".',
        },
        message_template: {
          type: "string",
          description:
            'Composed message; "{selection}" is replaced with the chosen values (comma-joined). E.g. "Filter my zones to: {selection}". Defaults to "{selection}".',
        },
      },
      required: ["prompt", "choices"],
    },
  },
  {
    name: "show_chart",
    description:
      'Render an interactive chart inline in the chat. Use whenever you present numeric data — statistics, usage, traffic, comparisons — instead of listing the numbers as text. Pass rows you already fetched. kind "line" or "area" for time series, "bar" for comparing categories. Keep it to at most 4 series; aggregate if you have more rows than ~200.',
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["line", "area", "bar"] },
        title: { type: "string", description: "Short chart title." },
        x_key: {
          type: "string",
          description: "Key in each data row holding the x-axis label (e.g. the date).",
        },
        series: {
          type: "array",
          description: `1-${MAX_SERIES} plotted series.`,
          items: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "Key in each data row holding this series' numeric value.",
              },
              label: {
                type: "string",
                description: "Legend label; defaults to the key.",
              },
            },
            required: ["key"],
          },
        },
        data: {
          type: "array",
          description: `Data rows (objects keyed by x_key and each series key). Max ${MAX_ROWS} rows — aggregate first if you have more.`,
          items: { type: "object" },
        },
        unit: {
          type: "string",
          description: 'Unit suffix for values, e.g. "GB" or "requests".',
        },
      },
      required: ["kind", "x_key", "series", "data"],
    },
  },
];

export const uiToolNames = new Set(uiTools.map((tool) => tool.name));

/** Appended to the system prompt so the model reaches for the UI tools. */
export const UI_TOOLS_GUIDANCE = `Rich UI:
The chat renders interactive components — prefer them over plain-text lists:
- Ending a reply with possible next steps ("Want me to: A, B, or C?") → call suggest_actions with one button per option instead of writing the list.
- A next step needs the user to pick parameters (filters, subsets, regions) → call ask_choices.
- Presenting numeric data (statistics, usage, traffic over time, comparisons) → call show_chart with the rows you fetched, plus a one-line takeaway in text. Don't also repeat the numbers as a list or table.
Button clicks and submitted choices arrive as regular user messages. Text you stream around these tools still appears — keep it brief and don't duplicate what the component shows.`;

function fail(message: string): never {
  throw new Error(message);
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Validate and normalize a UI tool call into a UIBlock. Throws with a
 * model-readable message on bad input so the agent can self-correct.
 */
export function buildUIBlock(name: string, input: Record<string, any>): UIBlock {
  switch (name) {
    case "suggest_actions": {
      const raw = Array.isArray(input.actions) ? input.actions : fail("actions must be an array");
      if (raw.length === 0) fail("actions must contain at least one entry");
      if (raw.length > MAX_ACTIONS) fail(`too many actions (max ${MAX_ACTIONS})`);
      const actions: UIAction[] = raw.map((entry: any, i: number) => {
        const label = asTrimmedString(entry?.label) ?? fail(`actions[${i}].label is required`);
        const action: UIAction = { label };
        const message = asTrimmedString(entry?.message);
        if (message) action.message = message;
        if (entry?.variant === "outline" || entry?.variant === "destructive") {
          action.variant = entry.variant;
        }
        return action;
      });
      const block: UIBlock = { type: "actions", actions };
      const prompt = asTrimmedString(input.prompt);
      if (prompt) block.prompt = prompt;
      return block;
    }

    case "ask_choices": {
      const prompt = asTrimmedString(input.prompt) ?? fail("prompt is required");
      const raw = Array.isArray(input.choices) ? input.choices : fail("choices must be an array");
      if (raw.length < 2) fail("choices must contain at least two entries");
      if (raw.length > MAX_CHOICES) fail(`too many choices (max ${MAX_CHOICES})`);
      const choices: UIChoice[] = raw.map((entry: any, i: number) => {
        const label = asTrimmedString(entry?.label) ?? fail(`choices[${i}].label is required`);
        const choice: UIChoice = { label };
        const value = asTrimmedString(entry?.value);
        if (value) choice.value = value;
        const description = asTrimmedString(entry?.description);
        if (description) choice.description = description;
        return choice;
      });
      const block: UIBlock = { type: "choices", prompt, choices };
      if (input.multi === true) block.multi = true;
      const submitLabel = asTrimmedString(input.submit_label);
      if (submitLabel) block.submitLabel = submitLabel;
      const messageTemplate = asTrimmedString(input.message_template);
      if (messageTemplate) block.messageTemplate = messageTemplate;
      return block;
    }

    case "show_chart": {
      const kind = input.kind;
      if (kind !== "line" && kind !== "area" && kind !== "bar") {
        fail('kind must be "line", "area", or "bar"');
      }
      const xKey = asTrimmedString(input.x_key) ?? fail("x_key is required");
      const rawSeries = Array.isArray(input.series) ? input.series : fail("series must be an array");
      if (rawSeries.length === 0) fail("series must contain at least one entry");
      if (rawSeries.length > MAX_SERIES) fail(`too many series (max ${MAX_SERIES})`);
      const series: UIChartSeries[] = rawSeries.map((entry: any, i: number) => {
        const key = asTrimmedString(entry?.key) ?? fail(`series[${i}].key is required`);
        const item: UIChartSeries = { key };
        const label = asTrimmedString(entry?.label);
        if (label) item.label = label;
        return item;
      });
      const rawData = Array.isArray(input.data) ? input.data : fail("data must be an array");
      if (rawData.length === 0) fail("data must contain at least one row");
      if (rawData.length > MAX_ROWS) {
        fail(`too many rows (max ${MAX_ROWS}) — aggregate the data first (e.g. daily instead of hourly)`);
      }
      const data = rawData.map((row: any, i: number) => {
        if (typeof row !== "object" || row === null) fail(`data[${i}] must be an object`);
        if (!(xKey in row)) fail(`data[${i}] is missing x_key "${xKey}"`);
        for (const s of series) {
          if (typeof row[s.key] !== "number") {
            fail(`data[${i}].${s.key} must be a number`);
          }
        }
        return row as Record<string, string | number>;
      });
      const block: UIBlock = { type: "chart", kind, xKey, series, data };
      const title = asTrimmedString(input.title);
      if (title) block.title = title;
      const unit = asTrimmedString(input.unit);
      if (unit) block.unit = unit;
      return block;
    }

    default:
      return fail(`Unknown UI tool: ${name}`);
  }
}
