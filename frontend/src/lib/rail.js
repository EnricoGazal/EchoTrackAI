import { useCallback, useEffect, useState } from "react";

const KEY = "echotrack-menu";

// Sem preferência salva: aberto em telas largas, recolhido em telas médias.
function initialOpen() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "open") return true;
    if (saved === "closed") return false;
  } catch {
    // navegação privada ou armazenamento bloqueado: segue o padrão
  }
  return typeof window === "undefined" || window.matchMedia("(min-width: 80rem)").matches;
}

/**
 * Estado do menu lateral (aberto ou recolhido). Fica salvo no navegador e
 * marca o <html> com data-rail, que ajusta a largura nos tokens.
 * Atalho: ⌘B no Mac, Ctrl+B no Windows e Linux.
 */
export function useRail() {
  const [open, setOpen] = useState(initialOpen);

  useEffect(() => {
    document.documentElement.dataset.rail = open ? "open" : "closed";
    try {
      localStorage.setItem(KEY, open ? "open" : "closed");
    } catch {
      // sem armazenamento: vale só para esta visita
    }
  }, [open]);

  useEffect(() => () => delete document.documentElement.dataset.rail, []);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return [open, toggle];
}
