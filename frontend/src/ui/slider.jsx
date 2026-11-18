import { Slider as S } from "radix-ui";
import { cn } from "../lib/utils";

/**
 * Slider no padrão do EchoTrack. `bipolar` desenha o preenchimento a partir
 * do centro (para controles de "menos ↔ mais").
 */
export function Slider({
  className,
  bipolar = false,
  min = 0,
  max = 100,
  value,
  tone = "ai",
  "aria-label": label,
  "aria-valuetext": valueText,
  ...props
}) {
  const v = value?.[0] ?? min;
  const pct = ((v - min) / (max - min)) * 100;
  const fill = bipolar
    ? { left: `${Math.min(50, pct)}%`, width: `${Math.abs(pct - 50)}%` }
    : { left: "0%", width: `${pct}%` };
  return (
    <S.Root
      min={min}
      max={max}
      value={value}
      className={cn("relative flex h-6 w-full touch-none items-center select-none", className)}
      {...props}
    >
      <S.Track className="relative h-1.5 grow overflow-hidden rounded-pill bg-surface-3">
        {bipolar && <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />}
        <span
          aria-hidden="true"
          className={cn("absolute inset-y-0 rounded-pill", tone === "ai" ? "bg-ai" : "bg-brand")}
          style={fill}
        />
      </S.Track>
      <S.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className={cn(
          "block size-5 rounded-pill bg-text-1 shadow-2 ring-4 ring-transparent",
          "transition-[box-shadow,transform] duration-(--duration-fast) ease-out",
          "hover:scale-110 focus-visible:outline-none focus-visible:ring-focus/40 active:scale-95"
        )}
      />
    </S.Root>
  );
}
