import { forwardRef } from "react";
import { cn } from "../lib/utils";

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-md bg-surface-2 px-4 text-body text-text-1 shadow-1 ring-1 ring-border",
        "placeholder:text-text-3 transition-[box-shadow,background-color] duration-(--duration-fast)",
        "hover:ring-border-strong focus-visible:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        "aria-invalid:ring-danger",
        className
      )}
      {...props}
    />
  );
});

export function Field({ label, hint, children, className }) {
  return (
    <label className={cn("grid gap-2", className)}>
      <span className="text-small font-medium text-text-1">{label}</span>
      {children}
      {hint && <span className="text-caption text-text-3 tracking-normal">{hint}</span>}
    </label>
  );
}
