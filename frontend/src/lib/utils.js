import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// O tailwind-merge precisa conhecer a escala de texto própria do EchoTrack
// para não confundir "text-small" (tamanho) com "text-text-2" (cor).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["hero", "hero-m", "display", "stat", "title", "heading", "body", "small", "caption"] }],
      "font-weight": [{ font: ["regular", "medium", "semibold", "heavy"] }],
      "font-family": [{ font: ["sans", "serif", "display", "display-tight", "display-wide"] }],
    },
  },
});

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
