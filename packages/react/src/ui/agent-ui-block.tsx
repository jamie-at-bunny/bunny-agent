"use client";

/**
 * Renderers for agent-emitted UI blocks (`ChatItem` kind "ui"): follow-up
 * action buttons, a choices form, and charts. Clicks/submits go through the
 * chat's own `send`, so a block interaction is just the user's next message.
 */
import type { UIBlock } from "@bunny.net/agent-core";
import { type ReactNode, useState } from "react";

import { cn } from "../lib/utils";
import { Bubble, BubbleContent } from "./bubble";
import { Button } from "./button";
import { AgentChart } from "./chart";
import { Message, MessageContent, MessageGroup } from "./message";

export interface AgentUIBlockProps {
  block: UIBlock;
  /** Sends a message as the user (the chat's own send). */
  onSend: (message: string) => void;
  /** True while a turn is streaming — interactions are disabled. */
  busy: boolean;
  /** The chat's user avatar node, shown next to user-side action drafts. */
  userAvatar?: ReactNode;
}

export function AgentUIBlock({
  block,
  onSend,
  busy,
  userAvatar,
}: AgentUIBlockProps) {
  switch (block.type) {
    case "actions":
      return (
        <ActionsBlock
          block={block}
          onSend={onSend}
          busy={busy}
          userAvatar={userAvatar}
        />
      );
    case "choices":
      return <ChoicesBlock block={block} onSend={onSend} busy={busy} />;
    case "chart":
      return <AgentChart block={block} />;
    default:
      return null;
  }
}

/**
 * Ready-to-send follow-ups, styled like the empty-state suggestions: drafts
 * of the user's next message, on the user's side of the chat.
 */
function ActionsBlock({
  block,
  onSend,
  busy,
  userAvatar,
}: AgentUIBlockProps & { block: Extract<UIBlock, { type: "actions" }> }) {
  return (
    <Message align="end">
      {userAvatar}
      <MessageContent>
        <MessageGroup>
          {block.prompt && (
            <span className="ba:self-end ba:text-xs ba:text-muted-foreground">
              {block.prompt}
            </span>
          )}
          {block.actions.map((action, i) => (
            <Bubble
              // biome-ignore lint/suspicious/noArrayIndexKey: a static list off one UI block — never reordered or spliced.
              key={i}
              variant={
                action.variant === "destructive" ? "destructive" : "outline"
              }
              align="end"
            >
              <BubbleContent
                render={
                  <button
                    type="button"
                    onClick={() => onSend(action.message ?? action.label)}
                    disabled={busy}
                  />
                }
                className="ba:disabled:opacity-50"
              >
                {action.label}
              </BubbleContent>
            </Bubble>
          ))}
        </MessageGroup>
      </MessageContent>
    </Message>
  );
}

/** Checkbox/radio picker; submitting composes and sends the user's message. */
function ChoicesBlock({
  block,
  onSend,
  busy,
}: Omit<AgentUIBlockProps, "userAvatar"> & {
  block: Extract<UIBlock, { type: "choices" }>;
}) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());

  const toggle = (index: number) => {
    setSelected((prev) => {
      if (!block.multi) return new Set([index]);
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const submit = () => {
    const selection = [...selected]
      .sort((a, b) => a - b)
      .map((i) => block.choices[i].value ?? block.choices[i].label)
      .join(", ");
    if (!selection) return;
    onSend(
      (block.messageTemplate ?? "{selection}").replaceAll(
        "{selection}",
        selection,
      ),
    );
  };

  return (
    <form
      className="ba:flex ba:w-full ba:max-w-md ba:flex-col ba:gap-2 ba:rounded-xl ba:border ba:border-border ba:bg-background ba:p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="ba:text-sm ba:font-medium ba:text-foreground">
        {block.prompt}
      </span>
      <div className="ba:flex ba:flex-col ba:gap-1">
        {block.choices.map((choice, i) => (
          <label
            // biome-ignore lint/suspicious/noArrayIndexKey: a static list off one UI block — the index IS the selection identity (see `selected`).
            key={i}
            className={cn(
              "ba:flex ba:cursor-pointer ba:items-start ba:gap-2.5 ba:rounded-lg ba:px-2 ba:py-1.5 ba:hover:bg-muted",
              busy && "ba:cursor-default ba:opacity-50",
            )}
          >
            <input
              type={block.multi ? "checkbox" : "radio"}
              name="agent-choice"
              checked={selected.has(i)}
              onChange={() => toggle(i)}
              disabled={busy}
              className="ba:mt-0.5 ba:size-4 ba:accent-primary"
            />
            <span className="ba:flex ba:min-w-0 ba:flex-col">
              <span>{choice.label}</span>
              {choice.description && (
                <span className="ba:text-xs ba:text-muted-foreground">
                  {choice.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <Button
        type="submit"
        size="sm"
        className="ba:self-start"
        disabled={busy || selected.size === 0}
      >
        {block.submitLabel ?? "Send"}
      </Button>
    </form>
  );
}
