"use client"

import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

function BubbleGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-group"
      className={cn("ba:flex ba:min-w-0 ba:flex-col ba:gap-2", className)}
      {...props}
    />
  )
}

const bubbleVariants = cva(
  "ba:group/bubble ba:relative ba:flex ba:w-fit ba:max-w-[80%] ba:min-w-0 ba:flex-col ba:gap-1 ba:group-data-[align=end]/message:self-end ba:data-[align=end]:self-end ba:data-[variant=ghost]:max-w-full",
  {
    variants: {
      variant: {
        default:
          "ba:*:data-[slot=bubble-content]:bg-primary ba:*:data-[slot=bubble-content]:text-primary-foreground ba:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-primary/80",
        secondary:
          "ba:*:data-[slot=bubble-content]:bg-secondary ba:*:data-[slot=bubble-content]:text-secondary-foreground ba:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        muted:
          "ba:*:data-[slot=bubble-content]:bg-muted ba:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]",
        tinted:
          "ba:*:data-[slot=bubble-content]:bg-[oklch(from_var(--primary)_0.93_calc(c*0.4)_h)] ba:*:data-[slot=bubble-content]:text-foreground ba:dark:*:data-[slot=bubble-content]:bg-[oklch(from_var(--primary)_0.3_calc(c*0.4)_h)] ba:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--primary)_0.88_calc(c*0.5)_h)] ba:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--primary)_0.35_calc(c*0.5)_h)]",
        outline:
          "ba:*:data-[slot=bubble-content]:border-border ba:*:data-[slot=bubble-content]:bg-background ba:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted ba:[&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground ba:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-input/30",
        ghost:
          "ba:border-none ba:*:data-[slot=bubble-content]:rounded-none ba:*:data-[slot=bubble-content]:bg-transparent ba:*:data-[slot=bubble-content]:p-0 ba:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted ba:[&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground ba:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted/50",
        destructive:
          "ba:*:data-[slot=bubble-content]:bg-destructive/10 ba:*:data-[slot=bubble-content]:text-destructive ba:dark:*:data-[slot=bubble-content]:bg-destructive/20 ba:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/20 ba:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Bubble({
  variant = "default",
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof bubbleVariants> & {
    align?: "start" | "end"
  }) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  )
}

function BubbleContent({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "ba:w-fit ba:max-w-full ba:min-w-0 ba:overflow-hidden ba:rounded-3xl ba:border ba:border-transparent ba:px-3 ba:py-2.5 ba:text-sm ba:leading-relaxed ba:wrap-break-word ba:group-data-[align=end]/bubble:self-end ba:[button]:text-left ba:[button,a]:transition-colors ba:[button,a]:outline-none ba:[button,a]:focus-visible:border-ring ba:[button,a]:focus-visible:ring-3 ba:[button,a]:focus-visible:ring-ring/30",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "bubble-content",
    },
  })
}

const bubbleReactionsVariants = cva(
  "ba:absolute ba:z-10 ba:flex ba:w-fit ba:shrink-0 ba:items-center ba:justify-center ba:gap-1 ba:rounded-full ba:bg-muted ba:px-1.5 ba:py-0.5 ba:text-sm ba:ring-3 ba:ring-card ba:has-[button]:p-0",
  {
    variants: {
      side: {
        top: "ba:top-0 ba:-translate-y-3/4",
        bottom: "ba:bottom-0 ba:translate-y-3/4",
      },
      align: {
        start: "ba:left-3",
        end: "ba:right-3",
      },
    },
    defaultVariants: {
      side: "bottom",
      align: "end",
    },
  }
)

function BubbleReactions({
  side = "bottom",
  align = "end",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end"
  side?: "top" | "bottom"
}) {
  return (
    <div
      data-slot="bubble-reactions"
      data-align={align}
      data-side={side}
      className={cn(bubbleReactionsVariants({ side, align }), className)}
      {...props}
    />
  )
}

export { BubbleGroup, Bubble, BubbleContent, BubbleReactions }

