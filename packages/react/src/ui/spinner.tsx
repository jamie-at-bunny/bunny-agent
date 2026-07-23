"use client"

import { Loader2Icon } from "lucide-react"

import { cn } from "../lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("ba:size-4 ba:animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
