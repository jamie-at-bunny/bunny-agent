"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import type * as React from "react";

import { cn } from "../lib/utils";

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg";
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "ba:group/avatar ba:relative ba:flex ba:size-8 ba:shrink-0 ba:rounded-full ba:select-none ba:after:absolute ba:after:inset-0 ba:after:rounded-full ba:after:border ba:after:border-border ba:after:mix-blend-darken ba:data-[size=lg]:size-10 ba:data-[size=sm]:size-6 ba:dark:after:mix-blend-lighten",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "ba:aspect-square ba:size-full ba:rounded-full ba:object-cover",
        className,
      )}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "ba:flex ba:size-full ba:items-center ba:justify-center ba:rounded-full ba:bg-muted ba:text-sm ba:text-muted-foreground ba:group-data-[size=sm]/avatar:text-xs",
        className,
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "ba:absolute ba:right-0 ba:bottom-0 ba:z-10 ba:inline-flex ba:items-center ba:justify-center ba:rounded-full ba:bg-primary ba:text-primary-foreground ba:bg-blend-color ba:ring-2 ba:ring-background ba:select-none",
        "ba:group-data-[size=sm]/avatar:size-2 ba:group-data-[size=sm]/avatar:[&>svg]:hidden",
        "ba:group-data-[size=default]/avatar:size-2.5 ba:group-data-[size=default]/avatar:[&>svg]:size-2",
        "ba:group-data-[size=lg]/avatar:size-3 ba:group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "ba:group/avatar-group ba:flex ba:-space-x-2 ba:*:data-[slot=avatar]:ring-2 ba:*:data-[slot=avatar]:ring-background",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "ba:relative ba:flex ba:size-8 ba:shrink-0 ba:items-center ba:justify-center ba:rounded-full ba:bg-muted ba:text-sm ba:text-muted-foreground ba:ring-2 ba:ring-background ba:group-has-data-[size=lg]/avatar-group:size-10 ba:group-has-data-[size=sm]/avatar-group:size-6 ba:[&>svg]:size-4 ba:group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 ba:group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
};
