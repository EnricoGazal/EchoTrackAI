import { useEffect, useRef, useState } from "react";

/**
 * Pede uma lista ao modelo sempre que `key` muda, mantendo a lista anterior
 * na tela enquanto a nova chega (nada pisca nem some). Mede o tempo e conta
 * quantas músicas entraram e saíram, para mostrar a IA reagindo.
 */
export function useSteeredList(fetcher, key, { debounce = 90 } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null, ms: null, diff: null });
  const previous = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const run = () => {
      const started = performance.now();
      fetcher({ signal: controller.signal })
        .then((data) => {
          const ids = new Set(data.recommendations?.map((s) => s.track_id) ?? data.steps?.map((s) => s.track_id) ?? []);
          let diff = null;
          if (previous.current) {
            const added = [...ids].filter((id) => !previous.current.has(id)).length;
            const removed = [...previous.current].filter((id) => !ids.has(id)).length;
            diff = { added, removed };
          }
          previous.current = ids;
          setState({ data, loading: false, error: null, ms: Math.round(performance.now() - started), diff });
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setState((s) => ({ ...s, loading: false, error: err }));
        });
    };
    // Primeira carga sem espera; enquanto arrasta um controle, uma pausa curtíssima.
    if (!previous.current) run();
    else timer.current = setTimeout(run, debounce);
    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const resetDiff = () => {
    previous.current = null;
  };
  return { ...state, resetDiff };
}

export function statusText({ loading, ms, diff, error }) {
  if (error) return "O modelo não respondeu. Tente de novo.";
  if (loading) return "O modelo está recalculando…";
  if (ms == null) return "";
  const speed = `Respondido em ${ms} ms`;
  if (!diff) return `${speed}.`;
  if (!diff.added) return `${speed} · a lista não mudou.`;
  return `${speed} · ${diff.added} ${diff.added === 1 ? "música entrou" : "músicas entraram"}, ${diff.removed} ${diff.removed === 1 ? "saiu" : "saíram"}.`;
}
