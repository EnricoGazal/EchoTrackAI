import { cn } from "../lib/utils";

/** Disco de vinil do EchoTrack: sulcos em grafite, selo âmbar e um anel de "eco" em ciano. */
export function Logo({ className, withName = true }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
        <circle cx="16" cy="16" r="15" fill="var(--logo-disc, var(--surface-3))" />
        <circle cx="16" cy="16" r="12.5" fill="none" stroke="var(--logo-groove, var(--border-strong))" strokeWidth="0.75" />
        <circle cx="16" cy="16" r="10" fill="none" stroke="var(--logo-groove, var(--border-strong))" strokeWidth="0.75" />
        <circle cx="16" cy="16" r="15" fill="none" stroke="var(--ai)" strokeWidth="1.25" strokeDasharray="10 84" strokeLinecap="round" />
        <circle cx="16" cy="16" r="6.5" fill="var(--logo-label, var(--brand))" />
        <circle cx="16" cy="16" r="1.6" fill="var(--logo-hole, var(--bg))" />
      </svg>
      {withName && <span className="font-display-wide text-heading font-semibold tracking-tight">EchoTrack</span>}
    </span>
  );
}
