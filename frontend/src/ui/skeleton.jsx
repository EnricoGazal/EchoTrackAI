import { cn } from "../lib/utils";

/** Bloco de carregamento. `scan` adiciona a varredura em ciano: "o modelo está analisando". */
export function Skeleton({ className, scan = false }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block overflow-hidden rounded-sm bg-surface-2",
        scan &&
          "after:absolute after:inset-y-0 after:-left-1/2 after:w-1/2 after:bg-[linear-gradient(90deg,transparent,var(--ai-dim),transparent)] after:opacity-30 after:animate-[scan_1.4s_var(--ease-in-out)_infinite]",
        className
      )}
    />
  );
}

/** Linha fina de progresso no topo de uma lista que a IA está recalculando. */
export function ScanLine({ active, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative block h-0.5 overflow-hidden rounded-pill transition-opacity duration-(--duration-base)",
        active ? "opacity-100" : "opacity-0",
        className
      )}
    >
      <span className="absolute inset-y-0 -left-1/3 w-1/3 rounded-pill bg-ai animate-[scan_0.9s_var(--ease-in-out)_infinite]" />
    </span>
  );
}
