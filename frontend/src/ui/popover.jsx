import { Popover as P } from "radix-ui";
import { cn } from "../lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({ className, align = "center", side = "bottom", sideOffset = 8, ...props }) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cn(
          "z-50 max-h-(--radix-popover-content-available-height) w-[min(27rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-lg bg-(--glass-bg) p-5 text-text-1 shadow-3 ring-1 ring-(--glass-ring) backdrop-blur-(--glass-blur) backdrop-saturate-150 [box-shadow:inset_0_1px_0_var(--glass-highlight),var(--shadow-3)]",
          "origin-(--radix-popover-content-transform-origin)",
          "data-[state=open]:animate-[pop-in_var(--duration-base)_var(--ease-out)]",
          "focus-visible:outline-none",
          className
        )}
        {...props}
      />
    </P.Portal>
  );
}
