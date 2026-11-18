import { Tooltip as T } from "radix-ui";
import { cn } from "../lib/utils";

export const TooltipProvider = ({ delayDuration = 300, ...props }) => (
  <T.Provider delayDuration={delayDuration} {...props} />
);

export function Tooltip({ content, children, side = "top" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 rounded-sm bg-surface-3 px-2.5 py-1.5 text-caption text-text-1 shadow-2",
            "data-[state=delayed-open]:animate-[pop-in_var(--duration-fast)_var(--ease-out)]"
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
