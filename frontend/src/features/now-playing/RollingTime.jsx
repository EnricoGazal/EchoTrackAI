import { cn } from "../../lib/utils";
import { formatTime } from "../../utils";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Um dígito que rola na vertical até o valor novo. */
function Digit({ value }) {
  return (
    <span className="relative inline-block h-[1.2em] w-[1ch] overflow-hidden align-bottom">
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-(--duration-slow) ease-out"
        style={{ transform: `translateY(${-Number(value) * 1.2}em)` }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1.2em] leading-[1.2em]">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Tempo em m:ss com troca de dígito animada (some com prefers-reduced-motion,
 * porque as durações dos tokens viram 0).
 */
export function RollingTime({ ms, prefix = "", className, label }) {
  const text = formatTime(ms);
  const chars = text.split("");
  return (
    <time className={cn("tabular inline-flex items-end leading-[1.2em]", className)}>
      <span className="sr-only">
        {label ? `${label}: ` : ""}
        {prefix ? "menos " : ""}
        {text}
      </span>
      <span aria-hidden="true" className="inline-flex">
        {prefix && <span>{prefix}</span>}
        {chars.map((c, i) => {
          // Chave contada da direita: "9:59" → "10:00" mantém os mesmos dígitos animando.
          const key = chars.length - i;
          return /\d/.test(c) ? <Digit key={key} value={c} /> : <span key={key}>{c}</span>;
        })}
      </span>
    </time>
  );
}
