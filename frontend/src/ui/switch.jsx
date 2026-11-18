import { Switch as S } from "radix-ui";
import { cn } from "../lib/utils";

export function Switch({ className, ...props }) {
  return (
    <S.Root
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill bg-surface-3 shadow-1",
        "transition-colors duration-(--duration-fast) data-[state=checked]:bg-ai",
        className
      )}
      {...props}
    >
      <S.Thumb
        className={cn(
          "block size-5 translate-x-0.5 rounded-pill bg-text-1 shadow-2",
          "transition-transform duration-(--duration-base) ease-spring data-[state=checked]:translate-x-5.5 data-[state=checked]:bg-on-ai"
        )}
      />
    </S.Root>
  );
}
