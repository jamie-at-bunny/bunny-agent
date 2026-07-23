"use client"

import * as React from "react"

import { cn } from "../lib/utils"

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-group"
      className={cn("ba:flex ba:min-w-0 ba:flex-col ba:gap-2", className)}
      {...props}
    />
  )
}

function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "ba:group/message ba:relative ba:flex ba:w-full ba:min-w-0 ba:gap-2 ba:text-sm ba:data-[align=end]:flex-row-reverse",
        className
      )}
      {...props}
    />
  )
}

function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        "ba:flex ba:w-fit ba:min-w-8 ba:shrink-0 ba:items-center ba:justify-center ba:self-end ba:overflow-hidden ba:rounded-full ba:bg-muted ba:group-has-data-[slot=message-footer]/message:-translate-y-8",
        className
      )}
      {...props}
    />
  )
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "ba:flex ba:w-full ba:min-w-0 ba:flex-col ba:gap-2.5 ba:wrap-break-word ba:group-data-[align=end]/message:*:data-slot:self-end",
        className
      )}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "ba:flex ba:max-w-full ba:min-w-0 ba:items-center ba:px-3 ba:text-xs ba:font-medium ba:text-muted-foreground ba:group-has-data-[variant=ghost]/message:px-0",
        className
      )}
      {...props}
    />
  )
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "ba:flex ba:max-w-full ba:min-w-0 ba:items-center ba:px-3 ba:text-xs ba:font-medium ba:text-muted-foreground ba:group-has-data-[variant=ghost]/message:px-0 ba:group-data-[align=end]/message:justify-end",
        className
      )}
      {...props}
    />
  )
}

export {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
}

