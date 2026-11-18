import { cn } from "../lib/utils";

export function Avatar({ name = "", className }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-pill bg-brand font-display-wide text-small font-semibold text-on-brand",
        className
      )}
    >
      {initial}
    </span>
  );
}
