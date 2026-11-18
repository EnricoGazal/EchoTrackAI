import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button, IconButton } from "../../ui/button";
import { Cover } from "../../ui/cover";
import { cleanTitle, splitArtists } from "../../utils";
import { cn } from "../../lib/utils";
import { Affinity, AiMark, AiOrigin, PickTag, WhyPopover } from "../ai/AiLayer";
import { RollingTime } from "./RollingTime";
import { Waveform } from "./Waveform";
import { useAmbient } from "./useAmbient";
import { CoverBackdrop } from "./CoverBackdrop";
import { setEmbedSlot } from "../player/embedSlot";

// Títulos curtos ficam enormes; longos reduzem um degrau e quebram em até 3 linhas.
function titleSize(title) {
  const n = title.length;
  if (n <= 12) return "text-hero";
  if (n <= 26) return "text-hero-m";
  return "text-display";
}

const EASE = [0.22, 1, 0.36, 1];

/**
 * Tela cheia do que está tocando. `origin` (de originFor) diz de onde a
 * música veio; quando há uma semente, o "Por que essa?" compara as duas.
 */
export function NowPlaying({
  song,
  origin,
  listName,
  upNext = [],
  playing,
  position,
  duration,
  onToggle,
  onPrev,
  onNext,
  onSeek,
  onMinimize,
  onArtist,
  onPickNext,
  hasPrev = true,
  reserveEmbed = false,
  needsTap = false,
}) {
  const reduce = useReducedMotion();
  const ambient = useAmbient(song);
  const title = cleanTitle(song.track_name);

  // Esc fecha a tela cheia.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !e.defaultPrevented && onMinimize?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMinimize]);

  const enter = reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" };
  const exit = reduce ? { opacity: 0 } : { opacity: 0, y: -12, filter: "blur(6px)" };

  return (
    <motion.section
      role="dialog"
      aria-modal="true"
      aria-label="Tocando agora"
      initial={reduce ? { opacity: 0 } : { y: "100%" }}
      animate={reduce ? { opacity: 1 } : { y: 0 }}
      exit={reduce ? { opacity: 0 } : { y: "100%" }}
      transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
      className={cn(
        "fixed inset-0 z-50 isolate flex flex-col overflow-x-hidden overflow-y-auto bg-bg [transition:--ambient_var(--duration-scene)_var(--ease-in-out)]"
      )}
      style={{ "--ambient": ambient }}
    >
      <CoverBackdrop song={song} />

      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
        <IconButton label="Minimizar" onClick={onMinimize} autoFocus>
          <ChevronDown />
        </IconButton>
        <p className="min-w-0 text-center text-caption uppercase text-text-2">
          Tocando agora
          {listName && (
            <span className="block truncate text-small normal-case tracking-normal text-text-1">{listName}</span>
          )}
        </p>
        <span className="size-10" aria-hidden="true" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-8 text-center sm:px-8">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={song.track_id}
            className="flex w-full flex-col items-center"
            initial={enter}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={exit}
            transition={{ duration: reduce ? 0 : 0.42, ease: EASE }}
          >
            <Cover song={song} className="size-28 rounded-md shadow-3 sm:size-36" />

            {origin ? (
              <AiOrigin origin={origin} className="mt-6" />
            ) : (
              <p className="mt-6 text-small text-text-2">Escolhida por você</p>
            )}

            <h1
              title={title}
              className={cn(
                "font-display-tight mt-4 max-w-[16ch] font-heavy text-balance text-text-1",
                "line-clamp-3 [overflow-wrap:anywhere]",
                titleSize(title)
              )}
            >
              {title}
            </h1>

            <p className="mt-3 max-w-full truncate text-heading text-text-2">
              {splitArtists(song.artists).map((a, i) => (
                <span key={a}>
                  {i > 0 && ", "}
                  <button
                    type="button"
                    onClick={() => onArtist?.(a)}
                    className="transition-colors duration-(--duration-fast) hover:text-text-1"
                  >
                    {a}
                  </button>
                </span>
              ))}
            </p>

            {origin && (song.similarity != null || song.sim_from != null) && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                {song.sim_from != null ? (
                  <BridgeShare song={song} />
                ) : (
                  <Affinity value={song.similarity} />
                )}
                {song.pick && (
                  <>
                    <span aria-hidden="true" className="hidden h-4 w-px bg-border-strong sm:block" />
                    <PickTag pick={song.pick} />
                  </>
                )}
                {origin.seed && <WhyPopover seed={origin.seed} song={song} />}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 w-full sm:mt-14">
          <Waveform song={song} position={position} duration={duration} onSeek={onSeek} />
          <div className="mt-3 flex justify-between text-small text-text-2">
            <RollingTime ms={position} label="Tempo decorrido" />
            <RollingTime ms={Math.max(0, duration - position)} prefix="–" label="Tempo restante" />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-6 sm:gap-8">
          <IconButton label="Música anterior" onClick={onPrev} disabled={!hasPrev}>
            <SkipBack fill="currentColor" />
          </IconButton>
          <Button variant="primary" size="icon-xl" aria-label={playing ? "Pausar" : "Tocar"} onClick={onToggle}>
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="translate-x-0.5" />}
          </Button>
          <IconButton label="Próxima música" onClick={onNext}>
            <SkipForward fill="currentColor" />
          </IconButton>
        </div>

        {reserveEmbed && (
          <div className="mt-8 grid w-[min(26rem,100%)] gap-2">
            {needsTap && (
              <p role="status" className="text-small font-semibold text-ai">
                Seu navegador pede um clique no ▶ do Spotify para liberar o som.
              </p>
            )}
            {/* espaço do player oficial do Spotify */}
            <div ref={setEmbedSlot} className="h-20 w-full rounded-md" />
          </div>
        )}
      </div>

      {upNext.length > 0 && (
        <footer className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-8 sm:pb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-caption uppercase text-text-2">A seguir</h2>
            {upNext.some((s) => s.similarity != null || s.because) && <AiMark size="sm" />}
          </div>
          <ol className="grid gap-2 lg:grid-cols-3">
            {upNext.slice(0, 3).map((s) => (
              <li key={s.track_id}>
                <button
                  type="button"
                  onClick={() => onPickNext?.(s)}
                  className="flex w-full items-center gap-3 rounded-md bg-surface-1/80 p-2 text-left transition-colors duration-(--duration-fast) hover:bg-surface-2"
                >
                  <Cover song={s} className="size-11 shrink-0 rounded-sm shadow-1" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-medium text-text-1">{cleanTitle(s.track_name)}</span>
                    <span className="block truncate text-caption text-text-2 tracking-normal">{splitArtists(s.artists).join(", ")}</span>
                  </span>
                  {s.similarity != null && s.sim_from == null && (
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Affinity value={s.similarity} size="sm" />
                      {s.pick === "diverse" && <PickTag pick="diverse" className="text-caption [&_svg]:size-3.5" />}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </footer>
      )}

    </motion.section>
  );
}

/** Na ponte: quanto a música lembra a de partida e a de chegada. */
export function BridgeShare({ song, size = "md" }) {
  const a = Math.round(Math.max(0, song.sim_from) * 100);
  const b = Math.round(Math.max(0, song.sim_to) * 100);
  const share = a + b > 0 ? (b / (a + b)) * 100 : 50;
  return (
    <span className={cn("inline-flex items-center gap-2 text-small", size === "sm" && "text-caption tracking-normal")}>
      <span className="tabular font-semibold text-text-1">{a}%</span>
      <span
        aria-hidden="true"
        className={cn("relative overflow-hidden rounded-pill bg-text-1", size === "sm" ? "h-1 w-10" : "h-1.5 w-16")}
      >
        <span className="absolute inset-y-0 right-0 bg-ai" style={{ width: `${share}%` }} />
      </span>
      <span className="tabular font-semibold text-ai">{b}%</span>
      <span className="sr-only">
        {a}% parecida com a música de partida e {b}% com a de chegada
      </span>
    </span>
  );
}
