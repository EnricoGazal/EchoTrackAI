import { AlertDialog } from "radix-ui";
import { Button } from "./button";

/** Confirmação para ações que não têm volta. */
export function Confirm({ open, onOpenChange, title, description, confirmLabel = "Confirmar", onConfirm, tone = "danger" }) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-[fade-in_var(--duration-fast)_var(--ease-out)]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 grid w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg bg-(--glass-bg) p-6 shadow-3 ring-1 ring-(--glass-ring) backdrop-blur-(--glass-blur) data-[state=open]:animate-[pop-in_var(--duration-base)_var(--ease-out)]">
          <AlertDialog.Title className="font-display-wide text-title font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-small text-text-2">{description}</AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancelar</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={tone === "danger" ? "outline" : "primary"} className={tone === "danger" ? "text-danger ring-danger" : ""} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
