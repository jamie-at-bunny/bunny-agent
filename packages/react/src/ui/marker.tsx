"use client"

import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

const markerVariants = cva(
  "ba:group/marker ba:relative ba:flex ba:min-h-4 ba:w-full ba:items-center ba:gap-2 ba:text-left ba:text-sm ba:text-muted-foreground ba:[&_svg:not([class*='size-'])]:size-4 ba:[a]:underline ba:[a]:underline-offset-3 ba:[a]:hover:text-foreground",
  {
    variants: {
      variant: {
        default: "",
        separator:
          "ba:before:mr-1 ba:before:h-px ba:before:min-w-0 ba:before:flex-1 ba:before:bg-border ba:after:ml-1 ba:after:h-px ba:after:min-w-0 ba:after:flex-1 ba:after:bg-border",
        border: "ba:border-b ba:border-border ba:pb-2",
      },
    },
  }
)

function Marker({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof markerVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(markerVariants({ variant, className })),
      },
      props
    ),
    render,
    state: {
      slot: "marker",
      variant,
    },
  })
}

function MarkerIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-icon"
      aria-hidden="true"
      className={cn(
        "ba:size-4 ba:shrink-0 ba:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function MarkerContent({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-content"
      className={cn(
        "ba:min-w-0 ba:wrap-break-word ba:group-data-[variant=separator]/marker:flex-none ba:group-data-[variant=separator]/marker:text-center ba:*:[a]:underline ba:*:[a]:underline-offset-3 ba:*:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Marker, MarkerIcon, MarkerContent, markerVariants }

