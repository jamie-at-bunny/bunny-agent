/**
 * @bunny-agent/handler — the backend half of the Bunny Agent. Runs the
 * model tool loop against the Bunny API via OpenRouter. This is the only
 * package that touches secrets (OpenRouter + Bunny keys).
 *
 * Framework-agnostic: handlers speak web-standard Request/Response, so they
 * mount in Hono, Next.js route handlers, Express (via adapters), Bun, etc.
 *
 *   const agent = createBunnyAgentHandler();
 *   app.post("/api/chat", (c) => agent.chat(c.req.raw));
 *   app.get("/api/status", () => agent.status());
 */
import OpenAI from "openai";
import type {
  AgentEvent,
  AgentStatus,
  ChatRequestBody,
  ToolErrorEvent,
  ToolSuccessEvent,
} from "@bunny-agent/shared";
import {
  AGENT_SYSTEM_PROMPT,
  BunnyClient,
  allTools,
  resolveApiKey,
  toolsByName,
} from "@bunny-agent/tools";
import { UI_TOOLS_GUIDANCE, buildUIBlock, uiToolNames, uiTools } from "./ui-tools.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface BunnyAgentHandlerOptions {
  /** Bunny API key. Defaults to BUNNY_API_KEY env / bunny CLI profile. */
  bunnyApiKey?: string;
  /** OpenRouter API key. Defaults to OPENROUTER_API_KEY env. */
  openRouterApiKey?: string;
  /** OpenRouter model slug to drive the agent, e.g. "anthropic/claude-opus-4.8". */
  model?: string;
  /** Extra instructions appended to the built-in system prompt. */
  systemSuffix?: string;
  /** Max model↔tools round trips per user turn. */
  maxTurns?: number;
  /**
   * Called after a tool runs successfully, with the tool's result — e.g. to
   * audit-log resource creation. Errors thrown here are logged, not fatal.
   */
  onToolSuccess?: (
    event: ToolSuccessEvent & { sessionId: string },
  ) => void | Promise<void>;
  /** Called after a tool run fails. Errors thrown here are logged, not fatal. */
  onToolError?: (
    event: ToolErrorEvent & { sessionId: string },
  ) => void | Promise<void>;
}

export interface BunnyAgentHandler {
  /** POST handler for chat turns — returns an SSE stream of AgentEvents. */
  chat(request: Request): Promise<Response>;
  /** GET handler reporting key/config status. */
  status(): Promise<Response>;
  /** Run a turn programmatically (no HTTP) — useful for tests and CLIs. */
  runTurn(
    sessionId: string,
    message: string,
    onEvent: (event: AgentEvent) => void | Promise<void>,
  ): Promise<void>;
}

/** A throwing user hook must not abort the agent turn — the tool already ran. */
async function runHook<T>(
  hook: ((event: T) => void | Promise<void>) | undefined,
  event: T,
): Promise<void> {
  try {
    await hook?.(event);
  } catch (error) {
    console.error("[bunny-agent] tool callback threw:", error);
  }
}

export function createBunnyAgentHandler(
  options: BunnyAgentHandlerOptions = {},
): BunnyAgentHandler {
  // const model = options.model ?? "anthropic/claude-opus-4.8";
  const model = options.model ?? "~anthropic/claude-haiku-latest";
  const maxTurns = options.maxTurns ?? 12;
  const basePrompt = `${AGENT_SYSTEM_PROMPT}\n\n${UI_TOOLS_GUIDANCE}`;
  const system = options.systemSuffix
    ? `${basePrompt}\n\n${options.systemSuffix}`
    : basePrompt;

  const chatTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    ...allTools,
    ...uiTools,
  ].map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema as Record<string, unknown>,
    },
  }));

  // Conversation state, keyed by session id. In-memory is fine for a single
  // instance; swap for Redis/DB when scaling out.
  const sessions = new Map<
    string,
    OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  >();

  const openRouterConfigured = () =>
    Boolean(options.openRouterApiKey || process.env.OPENROUTER_API_KEY);

  async function runTurn(
    sessionId: string,
    message: string,
    onEvent: (event: AgentEvent) => void | Promise<void>,
  ): Promise<void> {
    const history = sessions.get(sessionId) ?? [];
    sessions.set(sessionId, history);
    history.push({ role: "user", content: message });

    const openrouter = new OpenAI({
      apiKey: options.openRouterApiKey ?? process.env.OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
    });
    const bunny = new BunnyClient(options.bunnyApiKey);

    for (let turn = 0; turn < maxTurns; turn++) {
      const stream = openrouter.chat.completions.stream({
        model,
        max_tokens: 32000,
        messages: [{ role: "system", content: system }, ...history],
        tools: chatTools,
        // OpenRouter's unified reasoning param — not in the OpenAI types.
        ...({ reasoning: { enabled: true } } as Record<string, unknown>),
      });

      stream.on("content", (delta) => void onEvent({ type: "text", text: delta }));

      const completion = await stream.finalChatCompletion();
      const choice = completion.choices[0];
      history.push(choice.message);

      const toolCalls = (choice.message.tool_calls ?? []).filter(
        (call): call is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
          call.type === "function",
      );
      if (choice.finish_reason !== "tool_calls" || toolCalls.length === 0) break;

      for (const call of toolCalls) {
        const name = call.function.name;
        let input: Record<string, any>;
        try {
          input = JSON.parse(call.function.arguments || "{}");
        } catch {
          input = {};
        }
        // UI tools render components client-side: emit a `ui` event instead
        // of tool_start/tool_end, and skip the resource hooks — nothing ran
        // against the Bunny API.
        if (uiToolNames.has(name)) {
          try {
            const block = buildUIBlock(name, input);
            await onEvent({ type: "ui", block });
            history.push({
              role: "tool",
              tool_call_id: call.id,
              content:
                "Rendered to the user as an interactive component. Do not repeat its contents as text.",
            });
          } catch (error) {
            const messageText = error instanceof Error ? error.message : String(error);
            history.push({
              role: "tool",
              tool_call_id: call.id,
              content: `Error: ${messageText}`,
            });
          }
          continue;
        }

        await onEvent({ type: "tool_start", name, input });
        const tool = toolsByName.get(name);
        try {
          if (!tool) throw new Error(`Unknown tool: ${name}`);
          const result = await tool.run(bunny, input);
          history.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
          await onEvent({ type: "tool_end", name, ok: true, input, result });
          await runHook(options.onToolSuccess, { sessionId, name, input, result });
        } catch (error) {
          const messageText = error instanceof Error ? error.message : String(error);
          history.push({
            role: "tool",
            tool_call_id: call.id,
            content: `Error: ${messageText}`,
          });
          await onEvent({ type: "tool_end", name, ok: false, input, error: messageText });
          await runHook(options.onToolError, {
            sessionId,
            name,
            input,
            error: messageText,
          });
        }
      }
    }

    await onEvent({ type: "done" });
  }

  return {
    runTurn,

    async chat(request: Request): Promise<Response> {
      const { sessionId, message } = (await request
        .json()
        .catch(() => ({}))) as Partial<ChatRequestBody>;
      if (!sessionId || !message?.trim()) {
        return Response.json({ error: "sessionId and message are required" }, {
          status: 400,
        });
      }
      if (!openRouterConfigured()) {
        return Response.json(
          {
            error:
              "No OpenRouter credentials. Set OPENROUTER_API_KEY on the agent server and restart.",
          },
          { status: 503 },
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (event: AgentEvent) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          try {
            await runTurn(sessionId, message, emit);
          } catch (error) {
            emit({
              type: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    },

    async status(): Promise<Response> {
      const bunny: AgentStatus["bunny"] = { configured: false };
      try {
        resolveApiKey(options.bunnyApiKey);
        bunny.configured = true;
        try {
          const user = await new BunnyClient(options.bunnyApiKey).main<{
            Email: string;
          }>("GET", "/user");
          bunny.email = user.Email;
        } catch {
          // key present but account lookup failed — still "configured"
        }
      } catch {
        bunny.configured = false;
      }
      const body: AgentStatus = {
        bunny,
        openrouter: { configured: openRouterConfigured() },
      };
      return Response.json(body);
    },
  };
}
