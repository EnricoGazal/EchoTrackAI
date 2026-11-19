import { cn } from "../lib/utils";

/** Título de seção. `ai` mostra que o conteúdo veio do modelo. */
export function SectionHeader({ title, subtitle, action, mark, className, as: H = "h2" }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        {/* O selo (de onde veio o conteúdo) fica ao lado do título */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <H className="font-display-wide text-title font-semibold">{title}</H>
          {mark}
        </div>
        {subtitle && <p className="mt-1 max-w-[60ch] text-small text-text-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = "neutral", title, children, action, className }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-md bg-surface-1 p-4 shadow-1 ring-1",
        tone === "danger" ? "ring-danger/50" : "ring-border",
        className
      )}
    >
      <div className="min-w-0">
        {title && <p className="text-small font-semibold text-text-1">{title}</p>}
        <div className="text-small text-text-2">{children}</div>
      </div>
      {action}
    </div>
  );
}
