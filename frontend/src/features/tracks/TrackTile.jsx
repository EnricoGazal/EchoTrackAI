import { Pause, Play, Radio } from "lucide-react";
import { Cover } from "../../ui/cover";
import { cleanTitle, formatArtists } from "../../utils";
import { cn } from "../../lib/utils";
import { prefetchRadio } from "../../api";
import { Equalizer } from "./Equalizer";

/**
 * Capa + título. Passar o mouse já pré-carrega o rádio da música (o clique
 * abre a playlist na hora). `because` mostra de onde veio a recomendação.
 */
export function TrackTile({ song, playing, paused, onPlay, onOpen, round = false, subtitle, because, className }) {
  const current = playing;
  return (
    <div
      className={cn("group relative grid gap-3", className)}
      onPointerEnter={() => song.track_id && prefetchRadio(song.track_id)}
      onFocus={() => song.track_id && prefetchRadio(song.track_id)}
    >
      <div className="relative">
        <button type="button" onClick={() => onOpen?.(song)} className={cn("block w-full", round ? "rounded-pill" : "rounded-md")} aria-label={`Abrir ${cleanTitle(song.track_name || "")}`}>
          <Cover
            song={song}
            className={cn(
              "w-full transition-[transform,box-shadow] duration-(--duration-base) ease-out group-hover:-translate-y-0.5 group-hover:shadow-3",
              round ? "rounded-pill" : "rounded-md"
            )}
          />
        </button>
        {onPlay && (
          <button
            type="button"
            onClick={() => onPlay(song)}
            aria-label={current && !paused ? "Pausar" : `Tocar ${cleanTitle(song.track_name || "")}`}
            className={cn(
              "absolute right-2 bottom-2 grid size-11 place-items-center rounded-pill bg-brand text-on-brand shadow-2",
              "translate-y-1 opacity-0 transition-[opacity,transform] duration-(--duration-base) ease-out",
              "group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100",
              current && "translate-y-0 opacity-100"
            )}
          >
            {current && !paused ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5 translate-x-px" fill="currentColor" />}
          </button>
        )}
      </div>
      <div className="min-w-0">
        <button type="button" onClick={() => onOpen?.(song)} className="flex max-w-full items-center gap-2 text-left">
          {current && <Equalizer playing={!paused} className="shrink-0" />}
          <span className={cn("truncate text-small font-semibold", current ? "text-brand" : "text-text-1")}>
            {cleanTitle(song.track_name || "")}
          </span>
        </button>
        <p className="truncate text-small text-text-2">{subtitle ?? formatArtists(song.artists)}</p>
        {because && (
          <p className="mt-1 flex items-center gap-1.5 text-caption text-text-2 tracking-normal">
            <Radio aria-hidden="true" className="size-3.5 shrink-0 text-ai" />
            <span className="truncate">{because}</span>
          </p>
        )}
      </div>
    </div>
  );
}
