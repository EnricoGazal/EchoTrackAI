import { DropdownMenu as D } from "radix-ui";
import { cn } from "../lib/utils";

export const Menu = D.Root;
export const MenuTrigger = D.Trigger;

export function MenuContent({ className, align = "end", side = "bottom", children, ...props }) {
  return (
    <D.Portal>
      <D.Content
        align={align}
        side={side}
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          "z-50 min-w-60 rounded-md bg-(--glass-bg) p-1.5 text-text-1 shadow-3 ring-1 ring-(--glass-ring) backdrop-blur-(--glass-blur)",
          "data-[state=open]:animate-[pop-in_var(--duration-fast)_var(--ease-out)]",
          className
        )}
        {...props}
      >
        {children}
      </D.Content>
    </D.Portal>
  );
}

export function MenuItem({ className, tone, ...props }) {
  return (
    <D.Item
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-small outline-none select-none",
        "data-highlighted:bg-surface-3/70 [&_svg]:size-4 [&_svg]:text-text-2",
        tone === "danger" && "text-danger [&_svg]:text-danger",
        tone === "ai" && "[&_svg]:text-ai",
        className
      )}
      {...props}
    />
  );
}

export const MenuLabel = ({ className, ...props }) => (
  <D.Label className={cn("px-3 pt-2 pb-1 text-caption text-text-3 tracking-normal", className)} {...props} />
);
export const MenuSeparator = () => <D.Separator className="my-1 h-px bg-(--glass-ring)" />;
