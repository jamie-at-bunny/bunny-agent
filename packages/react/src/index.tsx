"use client";

import {
  BunnyAgentClient,
  createSessionId,
  reduceChatItems,
  restoreChatItems,
  type AgentStatus,
  type ChatItem,
  type ToolErrorEvent,
  type ToolSuccessEvent,
} from "@bunny-agent/core";
import { CheckIcon, SquarePenIcon, XIcon } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Streamdown } from "streamdown";

import { cn } from "./lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Bubble, BubbleContent } from "./ui/bubble";
import { Button } from "./ui/button";
import { Marker, MarkerContent, MarkerIcon } from "./ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
} from "./ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "./ui/message-scroller";
import { Spinner } from "./ui/spinner";
import { AgentUIBlock } from "./ui/agent-ui-block";

export interface BunnyAgentUser {
  /** Display name; used for the initials avatar when no image is provided. */
  name?: string;
  /** Avatar image URL. */
  avatarUrl?: string;
}

export interface BunnyAgentChatProps {
  /** Origin of the agent server. Defaults to same-origin. */
  baseUrl?: string;
  /** Compact layout for embedding in panels/iframes. */
  compact?: boolean;
  /**
   * The current user, shown as an avatar next to their messages. Provide
   * `avatarUrl` for an image or just `name` for an initials placeholder.
   * Omit entirely to hide the avatar column.
   */
  user?: BunnyAgentUser;
  /**
   * Quick-start suggestions shown on the empty state as ready-to-send
   * message bubbles on the user's side of the chat.
   */
  suggestions?: string[];
  /** Extra class on the root element for styling overrides. */
  className?: string;
  /** Called with connection status once known (e.g. to surface config problems). */
  onStatus?: (status: AgentStatus) => void;
  /**
   * Called whenever the agent runs a tool successfully, with the tool's
   * result — e.g. navigate to a resource page after `create_pull_zone`.
   */
  onToolSuccess?: (event: ToolSuccessEvent) => void;
  /** Called whenever a tool run fails. */
  onToolError?: (event: ToolErrorEvent) => void;
  /**
   * Pin the conversation to a known session id instead of minting one per
   * mount. The server keeps LLM history per session id, so reusing an id
   * resumes the agent's context. When set, the built-in "new chat" button is
   * hidden — starting over is the caller's job (pass a different id).
   */
  sessionId?: string;
  /**
   * Transcript to preload (e.g. from your own storage). Initial value only —
   * later changes are ignored. When `persist` is on and a stored transcript
   * exists, the stored one wins.
   */
  initialItems?: ChatItem[];
  /** Called with the full transcript whenever it changes. */
  onItemsChange?: (items: ChatItem[]) => void;
  /**
   * Persist the session id and transcript to localStorage so the chat
   * survives reloads. Pass a string to override the storage key (needed when
   * embedding multiple independent chats on one origin).
   */
  persist?: boolean | string;
}

const DEFAULT_STORAGE_KEY = "bunny-agent-chat";

const DEFAULT_SUGGESTIONS = [
  "Create database",
  "Create an S3 bucket",
  "Show me my recent pull zone stats",
  "Deploy a Docker container",
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

function toolLabel(name: string): string {
  return name.replaceAll("_", " ");
}

/** Consecutive same-kind items render as one block (message group / tool run). */
type Block =
  | { kind: "user" | "assistant"; items: Extract<ChatItem, { kind: "user" | "assistant" }>[] }
  | { kind: "tool"; items: Extract<ChatItem, { kind: "tool" }>[] }
  | { kind: "ui"; items: Extract<ChatItem, { kind: "ui" }>[] };

function groupItems(items: ChatItem[]): Block[] {
  const blocks: Block[] = [];
  for (const item of items) {
    const last = blocks[blocks.length - 1];
    if (last && last.kind === item.kind) {
      last.items.push(item as never);
    } else {
      blocks.push({ kind: item.kind, items: [item] } as Block);
    }
  }
  return blocks;
}

declare global {
  interface Window {
    /** Console handle for the chat client: `__bunnyAgent.devMode = true`. */
    __bunnyAgent?: BunnyAgentClient;
  }
}

/**
 * Drop-in Bunny Agent chat. Import the base styles once:
 *
 *   import "@bunny-agent/react/styles.css";
 *
 * Theme via CSS variables on `.ba-chat` (--ba-accent, --ba-surface, ...) or
 * ship your own stylesheet — everything this component emits is namespaced
 * (`ba-*` classes, `ba:` utility prefix, `data-slot` attributes).
 *
 * Developer mode (detailed tool-call pills instead of quiet status markers)
 * can be toggled from the browser console: `__bunnyAgent.devMode = true`.
 */
export function BunnyAgentChat({
  baseUrl,
  compact = false,
  user,
  suggestions = DEFAULT_SUGGESTIONS,
  className,
  onStatus,
  onToolSuccess,
  onToolError,
  sessionId: controlledSessionId,
  initialItems,
  onItemsChange,
  persist = false,
}: BunnyAgentChatProps) {
  // Refs keep the client stable when callers pass inline callbacks.
  const onToolSuccessRef = useRef(onToolSuccess);
  onToolSuccessRef.current = onToolSuccess;
  const onToolErrorRef = useRef(onToolError);
  onToolErrorRef.current = onToolError;
  const client = useMemo(
    () =>
      new BunnyAgentClient({
        baseUrl,
        onToolSuccess: (event) => onToolSuccessRef.current?.(event),
        onToolError: (event) => onToolErrorRef.current?.(event),
      }),
    [baseUrl],
  );
  const storageKey = persist
    ? typeof persist === "string"
      ? persist
      : DEFAULT_STORAGE_KEY
    : null;
  const sessionId = useRef(controlledSessionId ?? createSessionId());
  if (controlledSessionId) sessionId.current = controlledSessionId;
  const [items, setItems] = useState<ChatItem[]>(() =>
    restoreChatItems(initialItems ?? []),
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hydration happens in an effect (not the state initializer) so SSR markup
  // matches the first client render. Until the current key has hydrated,
  // nothing is written back to storage — otherwise the initial empty
  // transcript would clobber the stored one.
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const stored = JSON.parse(raw) as {
          sessionId?: string;
          items?: ChatItem[];
        };
        if (!controlledSessionId && typeof stored.sessionId === "string") {
          sessionId.current = stored.sessionId;
        }
        const restored = restoreChatItems(stored.items);
        if (restored.length > 0) setItems(restored);
      }
    } catch {
      // Corrupt entry — start fresh; the next write replaces it.
    }
    setHydratedKey(storageKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per storage key
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || hydratedKey !== storageKey) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ sessionId: sessionId.current, items }),
      );
    } catch {
      // Quota exceeded or storage unavailable — persistence degrades silently.
    }
  }, [storageKey, hydratedKey, items]);

  const onItemsChangeRef = useRef(onItemsChange);
  onItemsChangeRef.current = onItemsChange;
  useEffect(() => {
    onItemsChangeRef.current?.(items);
  }, [items]);

  const reset = () => {
    if (busy) return;
    setItems([]);
    sessionId.current = createSessionId();
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {}
    }
  };

  const devMode = useSyncExternalStore(
    (listener) => client.onDevModeChange(listener),
    () => client.devMode,
    () => false,
  );

  useEffect(() => {
    window.__bunnyAgent = client;
    return () => {
      if (window.__bunnyAgent === client) delete window.__bunnyAgent;
    };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    client
      .status()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        onStatus?.(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, onStatus]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setInput("");
    setItems((prev) => [...prev, { kind: "user", text: message }]);
    try {
      await client.send(sessionId.current, message, (event) =>
        setItems((prev) => reduceChatItems(prev, event)),
      );
    } catch (error) {
      setItems((prev) => [
        ...prev,
        {
          kind: "assistant",
          text: `⚠️ ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const missingOpenRouter = status && !status.openrouter.configured;
  const missingBunny = status && !status.bunny.configured;
  const showAvatar = Boolean(user?.avatarUrl || user?.name);
  const blocks = groupItems(items);

  const userAvatar = showAvatar ? (
    <MessageAvatar>
      <Avatar>
        {user?.avatarUrl && (
          <AvatarImage src={user.avatarUrl} alt={user?.name ?? "You"} />
        )}
        {user?.name && <AvatarFallback>{initials(user.name)}</AvatarFallback>}
      </Avatar>
    </MessageAvatar>
  ) : null;

  return (
    <div
      className={cn(
        "ba-chat ba:flex ba:min-h-0 ba:flex-1 ba:flex-col ba:overflow-hidden ba:bg-background ba:text-sm",
        compact
          ? "ba:h-full"
          : // The max-height bound is load-bearing: in an unconstrained flow
            // layout the root would grow with its content, the message
            // viewport would never scroll, and its scroll-anchor spacer
            // would inflate without bound.
            "ba:max-h-dvh ba:min-h-[480px] ba:rounded-xl ba:border ba:border-border",
        className,
      )}
    >
      {(missingOpenRouter || missingBunny) && (
        <div className="ba:flex ba:flex-col ba:gap-1 ba:border-b ba:border-amber-200 ba:bg-amber-50 ba:px-4 ba:py-2.5 ba:text-xs ba:text-amber-900">
          {missingOpenRouter && (
            <span>
              Missing OpenRouter credentials — set{" "}
              <code className="ba:font-mono">OPENROUTER_API_KEY</code> on the
              agent server.
            </span>
          )}
          {missingBunny && (
            <span>
              Missing Bunny credentials — set{" "}
              <code className="ba:font-mono">BUNNY_API_KEY</code> on the agent
              server.
            </span>
          )}
        </div>
      )}
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="ba:flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="ba:gap-5 ba:p-4">
              {items.length === 0 && (
                <>
                  <div className="ba:m-auto ba:flex ba:max-w-md ba:flex-col ba:items-center ba:gap-4 ba:py-10 ba:text-center">
                    <p className="ba:text-muted-foreground">
                      Hi! I&apos;m the Bunny Agent. I can create databases,
                      define schemas, set up storage buckets, manage pull
                      zones, DNS, and more — and hand you the credentials.
                    </p>
                  </div>
                  {/* Ready-to-send drafts, styled like the user's own bubbles. */}
                  <Message align="end">
                    {userAvatar}
                    <MessageContent>
                      <MessageGroup>
                        {suggestions.map((suggestion) => (
                          <Bubble key={suggestion} variant="outline" align="end">
                            <BubbleContent
                              render={
                                <button
                                  type="button"
                                  onClick={() => void send(suggestion)}
                                  disabled={busy}
                                />
                              }
                              className="ba:disabled:opacity-50"
                            >
                              {suggestion}
                            </BubbleContent>
                          </Bubble>
                        ))}
                        <Bubble variant="outline" align="end">
                          <BubbleContent
                            render={
                              <button
                                type="button"
                                onClick={() => inputRef.current?.focus()}
                                disabled={busy}
                              />
                            }
                            className="ba:text-muted-foreground ba:disabled:opacity-50"
                          >
                            Something else…
                          </BubbleContent>
                        </Bubble>
                      </MessageGroup>
                    </MessageContent>
                  </Message>
                </>
              )}
              {blocks.map((block, blockIndex) => (
                <MessageScrollerItem
                  key={blockIndex}
                  messageId={`block-${blockIndex}`}
                  scrollAnchor={block.kind === "user"}
                >
                  {block.kind === "ui" ? (
                    <div className="ba:flex ba:flex-col ba:gap-3">
                      {block.items.map((item, i) => (
                        <AgentUIBlock
                          key={i}
                          block={item.block}
                          onSend={(message) => void send(message)}
                          busy={busy}
                          userAvatar={userAvatar}
                        />
                      ))}
                    </div>
                  ) : block.kind === "tool" ? (
                    <div className="ba:flex ba:flex-col ba:gap-2">
                      {block.items.map((item, i) =>
                        devMode ? (
                          <div
                            key={i}
                            className={cn(
                              "ba:flex ba:w-fit ba:items-center ba:gap-2 ba:rounded-full ba:border ba:border-border ba:bg-muted ba:px-3 ba:py-1 ba:font-mono ba:text-xs ba:text-muted-foreground",
                              item.status === "error" &&
                                "ba:border-destructive/30 ba:bg-destructive/10 ba:text-destructive",
                            )}
                            title={item.error}
                          >
                            {item.status === "running" ? (
                              <Spinner className="ba:size-3" />
                            ) : item.status === "ok" ? (
                              <CheckIcon className="ba:size-3" />
                            ) : (
                              <XIcon className="ba:size-3" />
                            )}
                            <code>{item.name}</code>
                            <span>
                              {item.status === "running"
                                ? "running…"
                                : item.status === "ok"
                                  ? "done"
                                  : "failed"}
                            </span>
                          </div>
                        ) : (
                          <Marker key={i}>
                            <MarkerIcon>
                              {item.status === "running" ? (
                                <Spinner />
                              ) : item.status === "ok" ? (
                                <CheckIcon />
                              ) : (
                                <XIcon className="ba:text-destructive" />
                              )}
                            </MarkerIcon>
                            <MarkerContent>
                              {item.status === "running"
                                ? `${toolLabel(item.name)}…`
                                : item.status === "ok"
                                  ? toolLabel(item.name)
                                  : `${toolLabel(item.name)} failed`}
                            </MarkerContent>
                          </Marker>
                        ),
                      )}
                    </div>
                  ) : block.kind === "user" ? (
                    <Message align="end">
                      {userAvatar}
                      <MessageContent>
                        <MessageGroup>
                          {block.items.map((item, i) => (
                            <Bubble key={i} variant="default" align="end">
                              <BubbleContent className="ba:whitespace-pre-wrap">
                                {item.text}
                              </BubbleContent>
                            </Bubble>
                          ))}
                        </MessageGroup>
                      </MessageContent>
                    </Message>
                  ) : (
                    <Message align="start">
                      <MessageContent>
                        <MessageGroup>
                          {block.items.map((item, i) => (
                            <Bubble key={i} variant="ghost">
                              <BubbleContent>
                                <div className="typeset typeset-docs">
                                  <Streamdown
                                    controls={false}
                                    linkSafety={{ enabled: false }}
                                  >
                                    {item.text}
                                  </Streamdown>
                                </div>
                              </BubbleContent>
                            </Bubble>
                          ))}
                        </MessageGroup>
                      </MessageContent>
                    </Message>
                  )}
                </MessageScrollerItem>
              ))}
              {busy && (
                <Marker>
                  <MarkerIcon>
                    <Spinner />
                  </MarkerIcon>
                  <MarkerContent>thinking…</MarkerContent>
                </Marker>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <form
        className="ba:flex ba:gap-2 ba:border-t ba:border-border ba:p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        {!controlledSessionId && items.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={reset}
            disabled={busy}
            title="New chat"
            aria-label="New chat"
            className="ba:px-2.5"
          >
            <SquarePenIcon className="ba:size-4" />
          </Button>
        )}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Try "create a database for my blog"'
          disabled={busy}
          className="ba:h-9 ba:min-w-0 ba:flex-1 ba:rounded-2xl ba:border ba:border-input ba:bg-background ba:px-3 ba:outline-none ba:placeholder:text-muted-foreground ba:focus-visible:border-ring ba:focus-visible:ring-3 ba:focus-visible:ring-ring/30 ba:disabled:opacity-50"
        />
        <Button type="submit" size="lg" disabled={busy || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}

export {
  BunnyAgentLauncher,
  BunnyAgentProvider,
  BunnyAgentTrigger,
  BunnyAgentWindow,
  useBunnyAgent,
} from "./launcher";
export type {
  BunnyAgentProviderProps,
  BunnyAgentTriggerProps,
  BunnyAgentTriggerState,
  BunnyAgentWindowProps,
} from "./launcher";

export type {
  AgentStatus,
  ChatItem,
  ToolErrorEvent,
  ToolSuccessEvent,
  UIAction,
  UIBlock,
  UIChartSeries,
  UIChoice,
} from "@bunny-agent/core";
