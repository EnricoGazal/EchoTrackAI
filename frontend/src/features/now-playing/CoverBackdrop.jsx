import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { coverUrl } from "../../api";

/**
 * Fundo do "Tocando agora": a capa do álbum ocupando a tela, esmaecida e
 * levemente desfocada, com um véu escuro que garante o contraste do texto.
 * Sem capa, fica só a luz ambiente (cor derivada da música).
 */
export function CoverBackdrop({ song }) {
  const reduce = useReducedMotion();
  const [failed, setFailed] = useState({});
  const id = song.track_id;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Luz ambiente: aparece sozinha quando não há capa */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,var(--ambient),transparent_70%)] opacity-90" />

      <AnimatePresence initial={false}>
        {!failed[id] && (
          <motion.div
            key={id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.8, ease: [0.65, 0, 0.35, 1] }}
          >
            <img
              src={coverUrl(id)}
              alt=""
              decoding="async"
              onError={() => setFailed((f) => ({ ...f, [id]: true }))}
              className="size-full scale-(--cover-scale) object-cover opacity-(--cover-opacity) blur-(--cover-blur) saturate-125"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Véu: mais leve em cima (a capa aparece), sólido embaixo (controles e fila) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--bg)_30%,transparent)_0%,color-mix(in_oklch,var(--bg)_62%,transparent)_45%,var(--bg)_96%)]" />
    </div>
  );
}
