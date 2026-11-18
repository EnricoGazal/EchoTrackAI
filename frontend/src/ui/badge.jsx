import { cva } from "class-variance-authority";
import { cn } from "../lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-text-2",
        outline: "border border-border text-text-2",
        // Tudo que vem do modelo: mesma superfície dos outros componentes,
        // com o ícone em ciano (a cor exclusiva da camada IA).
        ai: "bg-surface-2/70 text-text-1 shadow-1 backdrop-blur-md [&_svg]:text-ai",
      },
      size: {
        sm: "h-6 px-2.5 text-caption tracking-normal",
        md: "h-8 px-3 text-small",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  }
);

export function Badge({ className, variant, size, ...props }) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
