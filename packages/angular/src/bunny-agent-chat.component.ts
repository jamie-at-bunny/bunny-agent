import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  input,
  type OnDestroy,
  type OnInit,
  output,
  signal,
  ViewEncapsulation,
  viewChild,
} from "@angular/core";

import {
  type AgentStatus,
  BunnyAgentClient,
  type ChatItem,
  createSessionId,
  reduceChatItems,
  type ToolErrorEvent,
  type ToolSuccessEvent,
} from "@bunny.net/agent-core";

export interface BunnyAgentUser {
  /** Display name; used for the initials avatar when no image is provided. */
  name?: string;
  /** Avatar image URL. */
  avatarUrl?: string;
}

const DEFAULT_SUGGESTIONS = [
  "Create a database called todo-app and add a tasks table",
  "Create a storage bucket and give me the credentials",
  "List my pull zones",
];

declare global {
  interface Window {
    /** Console handle for the chat client: `__bunnyAgent.devMode = true`. */
    __bunnyAgent?: BunnyAgentClient;
  }
}

/**
 * Drop-in Bunny Agent chat. Add the base styles once, e.g. in angular.json:
 *
 *   "styles": ["node_modules/@bunny.net/agent-core/styles.css", ...]
 *
 * Theme via CSS variables on `.ba-chat` (--ba-accent, --ba-surface, ...) or
 * override the stable `ba-*` class names.
 *
 * Developer mode (detailed tool-call pills instead of quiet status labels)
 * can be toggled from the browser console: `__bunnyAgent.devMode = true`.
 */
@Component({
  selector: "bunny-agent-chat",
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="ba-chat" [class.ba-chat--compact]="compact()">
      @if (missingOpenRouter() || missingBunny()) {
        <div class="ba-chat__banner">
          @if (missingOpenRouter()) {
            <span>
              Missing OpenRouter credentials — set
              <code>OPENROUTER_API_KEY</code> on the agent server.
            </span>
          }
          @if (missingBunny()) {
            <span>
              Missing Bunny credentials — set <code>BUNNY_API_KEY</code> on the
              agent server.
            </span>
          }
        </div>
      }
      <div class="ba-chat__messages" #messages>
        @if (items().length === 0) {
          <div class="ba-chat__empty">
            <div class="ba-chat__empty-icon" aria-hidden="true">🐰</div>
            <p>
              Hi! I'm the Bunny Agent. I can create databases, define schemas,
              set up storage buckets, manage pull zones, DNS, and more — and
              hand you the credentials.
              @if (agentStatus()?.bunny?.email; as email) {
                Connected as <strong>{{ email }}</strong
                >.
              }
            </p>
            <div class="ba-chat__suggestions">
              @for (suggestion of suggestions(); track suggestion) {
                <button
                  type="button"
                  [disabled]="busy()"
                  (click)="send(suggestion)"
                >
                  {{ suggestion }}
                </button>
              }
            </div>
          </div>
        }
        @for (item of items(); track $index) {
          @switch (item.kind) {
            @case ("user") {
              <div class="ba-chat__row ba-chat__row--user">
                @if (showAvatar()) {
                  <div class="ba-chat__avatar">
                    @if (user()?.avatarUrl; as avatarUrl) {
                      <img [src]="avatarUrl" [alt]="user()?.name ?? 'You'" />
                    } @else {
                      {{ initials(user()?.name ?? "") }}
                    }
                  </div>
                }
                <div class="ba-chat__bubble ba-chat__bubble--user">
                  {{ item.text }}
                </div>
              </div>
            }
            @case ("assistant") {
              <div class="ba-chat__bubble ba-chat__bubble--assistant">
                {{ item.text }}
              </div>
            }
            @case ("tool") {
              <div
                class="ba-chat__tool"
                [class.ba-chat__tool--running]="item.status === 'running'"
                [class.ba-chat__tool--ok]="item.status === 'ok'"
                [class.ba-chat__tool--error]="item.status === 'error'"
                [title]="item.error ?? ''"
              >
                <span class="ba-chat__tool-dot" aria-hidden="true"></span>
                @if (devMode()) {
                  <code>{{ item.name }}</code>
                  <span>{{
                    item.status === "running"
                      ? "running…"
                      : item.status === "ok"
                        ? "done"
                        : "failed"
                  }}</span>
                } @else {
                  <span>{{
                    item.status === "running"
                      ? toolLabel(item.name) + "…"
                      : item.status === "ok"
                        ? toolLabel(item.name)
                        : toolLabel(item.name) + " failed"
                  }}</span>
                }
              </div>
            }
          }
        }
        @if (busy()) {
          <div class="ba-chat__typing">thinking…</div>
        }
      </div>
      <form class="ba-chat__composer" (submit)="onSubmit($event)">
        <input
          [value]="inputText()"
          (input)="onInput($event)"
          placeholder='Try "create a database for my blog"'
          [disabled]="busy()"
        />
        <button type="submit" [disabled]="busy() || !inputText().trim()">
          Send
        </button>
      </form>
    </div>
  `,
  // The core stylesheet (@bunny.net/agent-core/styles.css) covers everything
  // except the host element and the avatar column, which are Angular-only.
  styles: `
    bunny-agent-chat {
      display: contents;
    }
    .ba-chat__row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    .ba-chat__row--user {
      align-self: flex-end;
      flex-direction: row-reverse;
      max-width: 85%;
    }
    .ba-chat__row--user .ba-chat__bubble {
      max-width: 100%;
    }
    .ba-chat__avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      overflow: hidden;
      background: var(--ba-surface-alt);
      border: 1px solid var(--ba-border);
      color: var(--ba-ink-soft);
      font-size: 11px;
      font-weight: 600;
    }
    .ba-chat__avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class BunnyAgentChatComponent implements OnInit, OnDestroy {
  /** Origin of the agent server. Defaults to same-origin. */
  readonly baseUrl = input<string>();
  /** Compact layout for embedding in panels/iframes. */
  readonly compact = input(false);
  /**
   * The current user, shown as an avatar next to their messages. Provide
   * `avatarUrl` for an image or just `name` for an initials placeholder.
   * Omit entirely to hide the avatar column.
   */
  readonly user = input<BunnyAgentUser>();
  /** Quick-start suggestion buttons shown on the empty state. */
  readonly suggestions = input<string[]>(DEFAULT_SUGGESTIONS);

  /** Emits connection status once known (e.g. to surface config problems). */
  readonly status = output<AgentStatus>();
  /**
   * Emits whenever the agent runs a tool successfully, with the tool's
   * result — e.g. navigate to a resource page after `create_pull_zone`.
   */
  readonly toolSuccess = output<ToolSuccessEvent>();
  /** Emits whenever a tool run fails. */
  readonly toolError = output<ToolErrorEvent>();

  protected readonly items = signal<ChatItem[]>([]);
  protected readonly inputText = signal("");
  protected readonly busy = signal(false);
  protected readonly agentStatus = signal<AgentStatus | null>(null);
  protected readonly devMode = signal(false);

  protected readonly missingOpenRouter = computed(() => {
    const status = this.agentStatus();
    return status !== null && !status.openrouter.configured;
  });
  protected readonly missingBunny = computed(() => {
    const status = this.agentStatus();
    return status !== null && !status.bunny.configured;
  });
  protected readonly showAvatar = computed(() => {
    const user = this.user();
    return Boolean(user?.avatarUrl || user?.name);
  });

  private readonly messagesEl =
    viewChild<ElementRef<HTMLDivElement>>("messages");
  private readonly sessionId = createSessionId();
  private client!: BunnyAgentClient;
  private unsubscribeDevMode?: () => void;
  private destroyed = false;

  constructor() {
    afterRenderEffect(() => {
      this.items();
      this.busy();
      const el = this.messagesEl()?.nativeElement;
      el?.scrollTo({ top: el.scrollHeight });
    });
  }

  ngOnInit(): void {
    this.client = new BunnyAgentClient({
      baseUrl: this.baseUrl(),
      onToolSuccess: (event) => this.toolSuccess.emit(event),
      onToolError: (event) => this.toolError.emit(event),
    });
    this.devMode.set(this.client.devMode);
    this.unsubscribeDevMode = this.client.onDevModeChange(() =>
      this.devMode.set(this.client.devMode),
    );
    if (typeof window !== "undefined") {
      window.__bunnyAgent = this.client;
    }
    this.client
      .status()
      .then((status) => {
        if (this.destroyed) return;
        this.agentStatus.set(status);
        this.status.emit(status);
      })
      .catch(() => {});
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.unsubscribeDevMode?.();
    if (typeof window !== "undefined" && window.__bunnyAgent === this.client) {
      delete window.__bunnyAgent;
    }
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("");
  }

  protected toolLabel(name: string): string {
    return name.replace(/_/g, " ");
  }

  protected onInput(event: Event): void {
    this.inputText.set((event.target as HTMLInputElement).value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.send(this.inputText());
  }

  protected async send(text: string): Promise<void> {
    const message = text.trim();
    if (!message || this.busy()) return;
    this.busy.set(true);
    this.inputText.set("");
    this.items.update((prev) => [...prev, { kind: "user", text: message }]);
    try {
      await this.client.send(this.sessionId, message, (event) =>
        this.items.update((prev) => reduceChatItems(prev, event)),
      );
    } catch (error) {
      this.items.update((prev) => [
        ...prev,
        {
          kind: "assistant",
          text: `⚠️ ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      this.busy.set(false);
    }
  }
}
