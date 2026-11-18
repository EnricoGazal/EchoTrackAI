import { useEffect, useState } from "react";
import { Disc3 } from "lucide-react";
import { coverUrl } from "../api";
import { cn } from "../lib/utils";

/**
 * Capa do álbum; sem capa, mostra um disco neutro.
 * Se a imagem falhar (ex.: o Spotify demorou a responder), tenta de novo
 * uma vez antes de desistir. O estado é por música: trocar de faixa no
 * mesmo lugar (como na barra do player) sempre tenta a capa nova.
 */
export function Cover({ song, className, alt = "" }) {
  const id = song?.track_id;
  const [state, setState] = useState({ id, tries: 0, failed: false });
  const current = state.id === id ? state : { id, tries: 0, failed: false };

  useEffect(() => {
    if (state.id !== id) setState({ id, tries: 0, failed: false });
  }, [id, state.id]);

  if (!song) return null;

  function onError() {
    if (current.tries < 1) {
      setTimeout(() => setState((s) => (s.id === id ? { ...s, tries: s.tries + 1 } : s)), 1500);
    } else {
      setState({ id, tries: current.tries, failed: true });
    }
  }

  const src = coverUrl(id) + (current.tries ? `?tentativa=${current.tries}` : "");

  return (
    <span className={cn("relative block aspect-square overflow-hidden rounded-md bg-surface-2 shadow-2", className)}>
      {id && !current.failed ? (
        <img
          key={src}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={onError}
          className="size-full object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center text-text-3">
          <Disc3 aria-hidden="true" className="size-1/2" strokeWidth={1.25} />
        </span>
      )}
    </span>
  );
}
