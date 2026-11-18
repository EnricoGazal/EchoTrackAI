import { cn } from "../../lib/utils";

/** Indicador de "tocando agora": três barras que pulsam (paradas quando pausado). */
export function Equalizer({ playing, className }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex h-3.5 items-end gap-0.5", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("w-[3px] origin-bottom rounded-pill bg-brand", playing ? "animate-[eq_0.9s_ease-in-out_infinite]" : "scale-y-50")}
          style={{ height: "100%", animationDelay: `${i * -0.25}s` }}
        />
      ))}
    </span>
  );
}
