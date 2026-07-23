"use client";

import { useRender } from "@base-ui/react/use-render";
import { ChevronDownIcon, MessageCircleIcon } from "lucide-react";
import * as React from "react";

import { cn } from "./lib/utils";

interface BunnyAgentLauncherContextValue {
  /** Whether the agent window is open. */
  open: boolean;
  /** Open or close the agent window. */
  setOpen: (open: boolean) => void;
  /** Flip the agent window between open and closed. */
  toggle: () => void;
  /** DOM id of the window panel, wired to the trigger via aria-controls. */
  panelId: string;
}

const BunnyAgentContext =
  React.createContext<BunnyAgentLauncherContextValue | null>(null);

/**
 * Open/close state for the agent window. Works anywhere under
 * `BunnyAgentProvider` — use it to build a custom trigger or drive the
 * window programmatically (e.g. open it after a failed deploy).
 */
export function useBunnyAgent(): BunnyAgentLauncherContextValue {
  const context = React.useContext(BunnyAgentContext);
  if (!context) {
    throw new Error("useBunnyAgent must be used within <BunnyAgentProvider>.");
  }
  return context;
}

export interface BunnyAgentProviderProps {
  children?: React.ReactNode;
  /** Controlled open state. Omit to let the provider manage it. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Called whenever a trigger, Escape, or `setOpen` changes the state. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Holds the agent window's open/close state. Mount once (e.g. in your app
 * shell) and place `BunnyAgentWindow` plus a trigger anywhere inside:
 *
 *   <BunnyAgentProvider>
 *     <App />
 *     <BunnyAgentLauncher />
 *     <BunnyAgentWindow>
 *       <BunnyAgentChat compact persist />
 *     </BunnyAgentWindow>
 *   </BunnyAgentProvider>
 *
 * Pass `open`/`onOpenChange` to control the state yourself instead.
 */
export function BunnyAgentProvider({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: BunnyAgentProviderProps) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  // Refs keep setOpen/toggle stable when callers pass inline callbacks.
  const openRef = React.useRef(open);
  openRef.current = open;
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (next === openRef.current) return;
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChangeRef.current?.(next);
    },
    [isControlled],
  );
  const toggle = React.useCallback(() => setOpen(!openRef.current), [setOpen]);

  const panelId = React.useId();
  const value = React.useMemo(
    () => ({ open, setOpen, toggle, panelId }),
    [open, setOpen, toggle, panelId],
  );

  return (
    <BunnyAgentContext.Provider value={value}>
      {children}
    </BunnyAgentContext.Provider>
  );
}

export interface BunnyAgentTriggerState {
  /** Whether the agent window is open. */
  open: boolean;
}

export type BunnyAgentTriggerProps = useRender.ComponentProps<
  "button",
  BunnyAgentTriggerState
>;

/**
 * Headless toggle for the agent window: a plain button wired with
 * open/close behavior and aria attributes, carrying `data-open` while the
 * window is open. Style it via `className`, or swap the element entirely
 * with `render` (e.g. `render={<MyButton />}`). For the ready-made
 * floating button, use `BunnyAgentLauncher` instead.
 */
export function BunnyAgentTrigger({
  render,
  onClick,
  ...props
}: BunnyAgentTriggerProps) {
  const { open, toggle, panelId } = useBunnyAgent();
  const state = React.useMemo(() => ({ open }), [open]);
  return useRender({
    render,
    defaultTagName: "button",
    state,
    props: {
      type: "button",
      "data-slot": "agent-trigger",
      "data-open": open ? "" : undefined,
      "aria-expanded": open,
      "aria-controls": panelId,
      "aria-haspopup": "dialog",
      ...props,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggle();
      },
    },
  });
}

/**
 * The default floating launcher: a fixed round gradient button in the
 * bottom-right corner that swaps between chat and close icons (the same
 * look as the embed.js loader). Reposition or restyle via `className`,
 * replace the icons via `children`, or drop it for `BunnyAgentTrigger` /
 * `useBunnyAgent` when you need full control.
 */
export function BunnyAgentLauncher({
  className,
  children,
  ...props
}: BunnyAgentTriggerProps) {
  const { open } = useBunnyAgent();
  return (
    <BunnyAgentTrigger
      aria-label={open ? "Close Bunny Agent" : "Open Bunny Agent"}
      data-slot="agent-launcher"
      className={cn(
        "ba-chat ba:group/launcher ba:fixed ba:right-6 ba:bottom-6 ba:z-[2147483000] ba:grid ba:size-14 ba:cursor-pointer ba:place-items-center ba:rounded-full ba:border-none ba:bg-[linear-gradient(85.19deg,#ff2a64_-133.27%,#ffaf48_105.93%)] ba:p-0 ba:text-white ba:shadow-[0_4px_16px_rgba(0,0,0,0.25)] ba:outline-none ba:transition-[transform,box-shadow] ba:duration-200 ba:hover:scale-106 ba:hover:shadow-[0_6px_24px_rgba(0,0,0,0.3)] ba:focus-visible:ring-3 ba:focus-visible:ring-white/50 ba:active:scale-85 ba:motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <span
            aria-hidden
            className="ba:col-start-1 ba:row-start-1 ba:transition-[transform,opacity] ba:duration-200 ba:group-data-open/launcher:rotate-60 ba:group-data-open/launcher:scale-60 ba:group-data-open/launcher:opacity-0 ba:motion-reduce:transition-none"
          >
            <MessageCircleIcon className="ba:size-6 ba:fill-current ba:stroke-none" />
          </span>
          <span
            aria-hidden
            className="ba:col-start-1 ba:row-start-1 ba:-rotate-60 ba:scale-60 ba:opacity-0 ba:transition-[transform,opacity] ba:duration-200 ba:group-data-open/launcher:rotate-0 ba:group-data-open/launcher:scale-100 ba:group-data-open/launcher:opacity-100 ba:motion-reduce:transition-none"
          >
            <ChevronDownIcon className="ba:size-6" strokeWidth={2.6} />
          </span>
        </>
      )}
    </BunnyAgentTrigger>
  );
}

export type BunnyAgentWindowProps = React.ComponentProps<"div">;

/**
 * The floating panel the chat lives in: fixed above the launcher,
 * animated open/close, dismissed with Escape. Children (typically
 * `<BunnyAgentChat compact />`) stay mounted while closed so the
 * conversation survives toggling. Reposition or resize via `className`.
 */
export function BunnyAgentWindow({
  className,
  children,
  ...props
}: BunnyAgentWindowProps) {
  const { open, setOpen, panelId } = useBunnyAgent();

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  return (
    <div
      id={panelId}
      role="dialog"
      aria-label="Bunny Agent"
      data-slot="agent-window"
      data-open={open ? "" : undefined}
      className={cn(
        // Closed state hides via visibility (removes the panel from the
        // a11y tree and tab order) while staying mounted to keep chat state.
        "ba-chat ba:invisible ba:fixed ba:right-6 ba:bottom-23 ba:z-[2147483000] ba:flex ba:h-150 ba:max-h-[calc(100dvh-7.5rem)] ba:w-100 ba:max-w-[calc(100vw-3rem)] ba:origin-bottom-right ba:translate-y-3 ba:scale-98 ba:flex-col ba:overflow-hidden ba:rounded-2xl ba:border ba:border-border ba:bg-background ba:opacity-0 ba:shadow-[0_12px_40px_rgba(0,0,0,0.25)] ba:transition-all ba:duration-200 ba:pointer-events-none ba:data-open:visible ba:data-open:translate-y-0 ba:data-open:scale-100 ba:data-open:opacity-100 ba:data-open:pointer-events-auto ba:motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
