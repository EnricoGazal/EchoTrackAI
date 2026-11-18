import { forwardRef } from "react";
import { Slot } from "radix-ui";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none",
    "font-sans font-semibold transition-[background-color,color,transform,box-shadow]",
    "duration-(--duration-fast) ease-out active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand text-on-brand hover:bg-brand-hover shadow-1",
        secondary: "bg-surface-2 text-text-1 hover:bg-surface-3 shadow-1",
        ghost: "text-text-2 hover:bg-surface-2 hover:text-text-1",
        outline: "border border-border-strong text-text-1 hover:bg-surface-2",
        // Ações que pedem algo ao modelo (ex.: "Por que essa?")
        ai: "bg-surface-2 text-text-1 shadow-1 hover:bg-surface-3 [&_svg]:text-ai",
      },
      size: {
        sm: "h-8 rounded-pill px-3 text-small [&_svg]:size-4",
        md: "h-10 rounded-pill px-4 text-small [&_svg]:size-4",
        lg: "h-12 rounded-pill px-6 text-body [&_svg]:size-5",
        icon: "size-10 rounded-pill [&_svg]:size-5",
        "icon-sm": "size-8 rounded-pill [&_svg]:size-4",
        "icon-xl": "size-16 rounded-pill [&_svg]:size-7",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export const Button = forwardRef(function Button(
  { className, variant, size, asChild = false, type = "button", ...props },
  ref
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

/** Botão só com ícone: exige um rótulo acessível. */
export const IconButton = forwardRef(function IconButton(
  { label, size = "icon", variant = "ghost", ...props },
  ref
) {
  return <Button ref={ref} size={size} variant={variant} aria-label={label} title={label} {...props} />;
});
