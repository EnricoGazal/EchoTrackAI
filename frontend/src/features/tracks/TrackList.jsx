import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AudioLines, Pause, Play } from "lucide-react";
import { Cover } from "../../ui/cover";
import { IconButton } from "../../ui/button";
import { Affinity, PickTag, WhyPopover } from "../ai/AiLayer";
import { cleanTitle, formatArtists, formatDuration, splitArtists } from "../../utils";
import { cn } from "../../lib/utils";
import { prefetchRadio } from "../../api";
import { Equalizer } from "./Equalizer";

/**
 * Lista de faixas. Quando as músicas vêm do modelo, cada linha mostra a
 * afinidade, o papel no MMR e o "Por que essa?". Quando a lista muda (rádio
 * dirigível), as linhas se reorganizam com animação e as que acabaram de
 * entrar piscam em ciano — dá para ver a IA reagindo.
 */
export function TrackList({
  items,
  seed,
  playingId,
  paused,
  onPlay,
  onRadio,
  onArtist,
  ai = true,
  numbered = true,
  extra,
  className,
}) {
  const reduce = useReducedMotion();
  const previous = useRef(null);
  const fresh = new Set();
  if (previous.current) for (const s of items) if (!previous.current.has(s.track_id)) fresh.add(s.track_id);
  useEffect(() => {
    previous.current = new Set(items.map((s) => s.track_id));
  }, [items]);

  return (
    <div className="@container">
    <ol className={cn("grid grid-cols-[minmax(0,1fr)] gap-0.5", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((song, i) => {
          const current = song.track_id === playingId;
          const isPlaying = current && !paused;
          return (
            <motion.li
              key={song.track_id}
              layout={reduce ? false : "position"}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                // A lista se adapta à largura que ela tem (não à da tela).
                "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md p-2",
                "@2xl:grid-cols-[2rem_auto_minmax(0,1fr)_6.5rem_auto_3rem] @2xl:gap-4",
                "@4xl:grid-cols-[2rem_auto_minmax(0,1fr)_8.5rem_6.5rem_auto_3rem]",
                "transition-colors duration-(--duration-fast) hover:bg-surface-1",
                current && "bg-surface-1",
                fresh.has(song.track_id) && "animate-[flash-ai_1.4s_var(--ease-out)]"
              )}
            >
              {numbered && (
                <span className="hidden justify-center text-small tabular text-text-3 @2xl:flex">
                  {current ? (
                    <Equalizer playing={isPlaying} />
                  ) : (
                    <>
                      <span className="group-hover:hidden">{i + 1}</span>
                      <Play aria-hidden="true" fill="currentColor" className="hidden size-3.5 text-text-1 group-hover:block" />
                    </>
                  )}
                </span>
              )}
              {!numbered && <span className="hidden @2xl:block" />}

              <button
                type="button"
                onClick={() => onPlay?.(song, i)}
                onPointerEnter={() => ai && prefetchRadio(song.track_id)}
                aria-label={isPlaying ? `Pausar ${cleanTitle(song.track_name)}` : `Tocar ${cleanTitle(song.track_name)}`}
                className="relative size-12 shrink-0 rounded-sm"
              >
                <Cover song={song} className="size-12 rounded-sm shadow-1" />
                <span
                  className={cn(
                    "absolute inset-0 grid place-items-center rounded-sm bg-overlay/60 text-text-1 opacity-0 transition-opacity duration-(--duration-fast)",
                    "group-hover:opacity-100 group-focus-within:opacity-100",
                    current && "opacity-100"
                  )}
                >
                  {isPlaying ? <Pause aria-hidden="true" fill="currentColor" className="size-4" /> : <Play aria-hidden="true" fill="currentColor" className="size-4" />}
                </span>
              </button>

              <span className="min-w-0">
                <button
                  type="button"
                  onClick={() => onPlay?.(song, i)}
                  className={cn("block max-w-full truncate text-left text-body font-medium", current ? "text-brand" : "text-text-1")}
                >
                  {cleanTitle(song.track_name)}
                </button>
                <span className="flex min-w-0 items-center gap-2 text-small text-text-2">
                  <span className="truncate">
                    {splitArtists(song.artists).map((a, k) => (
                      <span key={a}>
                        {k > 0 && ", "}
                        <button type="button" className="inline-flex min-h-6 items-center hover:text-text-1 hover:underline" onClick={() => onArtist?.(a)}>
                          {a}
                        </button>
                      </span>
                    ))}
                  </span>
                  {extra?.(song)}
                </span>
                {ai && song.similarity != null && (
                  <span className="mt-1 flex items-center gap-3 @4xl:hidden">
                    <span className="@2xl:hidden">
                      <Affinity value={song.similarity} size="sm" />
                    </span>
                    {song.pick === "diverse" && <PickTag pick="diverse" className="text-caption [&_svg]:size-3.5" />}
                  </span>
                )}
              </span>

              <span className="hidden @4xl:block">{ai && song.pick && <PickTag pick={song.pick} />}</span>
              <span className="hidden @2xl:block">{ai && song.similarity != null && <Affinity value={song.similarity} size="sm" />}</span>

              <span className="flex items-center gap-0.5">
                {ai && seed && song.similarity != null && <WhyPopover seed={seed} song={song} compact align="end" />}
                {onRadio && (
                  <IconButton label={`Criar rádio a partir de ${cleanTitle(song.track_name)}`} size="icon-sm" onClick={() => onRadio(song)}>
                    <AudioLines />
                  </IconButton>
                )}
              </span>

              <span className="hidden text-right text-small tabular text-text-3 @2xl:block">{formatDuration(song.duration_ms)}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
    </div>
  );
}

export const artistsText = formatArtists;
