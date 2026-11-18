import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../lib/utils";
import { IconButton } from "./button";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

/** Painel que sobe de baixo (celular) ou abre ao lado (telas grandes). */
export function SheetContent({ title, description, children, className, side = "bottom" }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-[fade-in_var(--duration-base)_var(--ease-out)]" />
      <Dialog.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-(--glass-bg) p-5 text-text-1 shadow-3 ring-1 ring-(--glass-ring) backdrop-blur-(--glass-blur) focus-visible:outline-none",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-lg pb-8 data-[state=open]:animate-[sheet-up_var(--duration-slow)_var(--ease-out)]",
          side === "right" &&
            "inset-y-0 right-0 w-[min(26rem,100vw)] overflow-y-auto data-[state=open]:animate-[sheet-left_var(--duration-slow)_var(--ease-out)]",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="font-display-wide text-title font-semibold">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-1 text-small text-text-2">{description}</Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}
          </div>
          <Dialog.Close asChild>
            <IconButton label="Fechar" size="icon-sm">
              <X />
            </IconButton>
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
