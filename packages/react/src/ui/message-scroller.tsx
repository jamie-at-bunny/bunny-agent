"use client";

import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";
import { ArrowDownIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";

function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
  return <MessageScrollerPrimitive.Provider {...props} />;
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        "ba:group/message-scroller ba:relative ba:flex ba:size-full ba:min-h-0 ba:flex-col ba:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn(
        "ba:size-full ba:min-h-0 ba:min-w-0 ba:scroll-fade-b ba:scrollbar-thin ba:scrollbar-gutter-stable ba:overflow-y-auto ba:overscroll-contain ba:contain-content ba:data-autoscrolling:scrollbar-thumb-transparent ba:data-autoscrolling:scrollbar-track-transparent",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn(
        "ba:flex ba:h-max ba:min-h-full ba:flex-col ba:gap-8",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn(
        "ba:min-w-0 ba:shrink-0 ba:[contain-intrinsic-size:auto_10rem] ba:[content-visibility:auto]",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerButton({
  direction = "end",
  className,
  children,
  render,
  variant = "secondary",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      data-variant={variant}
      data-size={size}
      direction={direction}
      className={cn(
        "ba:absolute ba:inset-s-1/2 ba:-translate-x-1/2 ba:border-border ba:bg-background ba:text-foreground ba:transition-[translate,scale,opacity] ba:duration-200 ba:hover:bg-muted ba:hover:text-foreground ba:data-[active=false]:pointer-events-none ba:data-[active=false]:scale-95 ba:data-[active=false]:opacity-0 ba:data-[active=false]:duration-400 ba:data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] ba:data-[active=true]:translate-y-0 ba:data-[active=true]:scale-100 ba:data-[active=true]:opacity-100 ba:data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] ba:data-[direction=end]:bottom-4 ba:data-[direction=end]:data-[active=false]:translate-y-full ba:data-[direction=start]:top-4 ba:data-[direction=start]:data-[active=false]:-translate-y-full ba:rtl:translate-x-1/2 ba:data-[direction=start]:[&_svg]:rotate-180",
        className,
      )}
      render={render ?? <Button variant={variant} size={size} />}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon />
          <span className="ba:sr-only">
            {direction === "end" ? "Scroll to end" : "Scroll to start"}
          </span>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  );
}

export {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
};
