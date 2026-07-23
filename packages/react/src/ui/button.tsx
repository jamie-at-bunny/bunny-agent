"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

const buttonVariants = cva(
  "ba:group/button ba:inline-flex ba:shrink-0 ba:items-center ba:justify-center ba:rounded-2xl ba:border ba:border-transparent ba:bg-clip-padding ba:text-sm ba:font-medium ba:whitespace-nowrap ba:transition-all ba:outline-none ba:select-none ba:focus-visible:border-ring ba:focus-visible:ring-3 ba:focus-visible:ring-ring/30 ba:active:not-aria-[haspopup]:translate-y-px ba:disabled:pointer-events-none ba:disabled:opacity-50 ba:aria-invalid:border-destructive ba:aria-invalid:ring-3 ba:aria-invalid:ring-destructive/20 ba:dark:aria-invalid:border-destructive/50 ba:dark:aria-invalid:ring-destructive/40 ba:[&_svg]:pointer-events-none ba:[&_svg]:shrink-0 ba:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "ba:bg-primary ba:text-primary-foreground ba:hover:bg-primary/80",
        outline:
          "ba:border-border ba:bg-background ba:hover:bg-muted ba:hover:text-foreground ba:aria-expanded:bg-muted ba:aria-expanded:text-foreground ba:dark:bg-transparent ba:dark:hover:bg-input/30",
        secondary:
          "ba:bg-secondary ba:text-secondary-foreground ba:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] ba:aria-expanded:bg-secondary ba:aria-expanded:text-secondary-foreground",
        ghost:
          "ba:hover:bg-muted ba:hover:text-foreground ba:aria-expanded:bg-muted ba:aria-expanded:text-foreground ba:dark:hover:bg-muted/50",
        destructive:
          "ba:bg-destructive/10 ba:text-destructive ba:hover:bg-destructive/20 ba:focus-visible:border-destructive/40 ba:focus-visible:ring-destructive/20 ba:dark:bg-destructive/20 ba:dark:hover:bg-destructive/30 ba:dark:focus-visible:ring-destructive/40",
        link: "ba:text-primary ba:underline-offset-4 ba:hover:underline",
      },
      size: {
        default:
          "ba:h-8 ba:gap-1.5 ba:px-3 ba:has-data-[icon=inline-end]:pr-2.5 ba:has-data-[icon=inline-start]:pl-2.5",
        xs: "ba:h-6 ba:gap-1 ba:px-2.5 ba:text-xs ba:has-data-[icon=inline-end]:pr-2 ba:has-data-[icon=inline-start]:pl-2 ba:[&_svg:not([class*='size-'])]:size-3",
        sm: "ba:h-7 ba:gap-1 ba:px-3 ba:has-data-[icon=inline-end]:pr-2 ba:has-data-[icon=inline-start]:pl-2",
        lg: "ba:h-9 ba:gap-1.5 ba:px-4 ba:has-data-[icon=inline-end]:pr-3 ba:has-data-[icon=inline-start]:pl-3",
        icon: "ba:size-8",
        "icon-xs": "ba:size-6 ba:[&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "ba:size-7",
        "icon-lg": "ba:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

