import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Maximize2, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX, X } from "lucide-react";
import { Button, IconButton } from "../../ui/button";
import { Cover } from "../../ui/cover";
import { Slider } from "../../ui/slider";
import { cleanTitle, formatArtists, formatTime } from "../../utils";
import { cn } from "../../lib/utils";
import { AiOriginInline } from "../ai/AiLayer";
import { Waveform } from "../now-playing/Waveform";

/**
 * Barra do player sempre visível. No computador: música e origem à esquerda,
 * controles e a forma de onda no centro; à direita, o player oficial do
 * Spotify (prévia) ou o volume (Premium). No celular vira um mini-player
 * que abre o "Tocando agora".
 */
export function PlayerDock({
  song,
  origin,
  engine,
  position,
  onPrev,
  onNext,
  hasPrev,
  onExpand,
  onClose,
  onConnect,
}) {
  const { playback, toggle, seek, kind, needsTap } = engine;
  const playing = !playback.paused;
  const duration = playback.duration || song.duration_ms || 0;
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <>
      {/* Computador */}
      <section
        aria-label="Player"
        className="fixed right-(--rail-gap) bottom-(--rail-gap) left-(--rail-offset) z-40 hidden h-22 items-center gap-6 rounded-xl bg-(--glass-bg) px-4 shadow-3 ring-1 ring-(--glass-ring) backdrop-blur-(--glass-blur) transition-[left] duration-(--duration-base) ease-(--ease-out) md:flex"
      >
        <div className="flex w-[clamp(14rem,24vw,22rem)] min-w-0 items-center gap-3">
          <button type="button" onClick={onExpand} className="shrink-0 rounded-sm" aria-label="Abrir tocando agora">
            <Cover song={song} className="size-14 rounded-sm" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-small font-semibold text-text-1">{cleanTitle(song.track_name)}</p>
            <p className="truncate text-caption text-text-2 tracking-normal">{formatArtists(song.artists)}</p>
            <AiOriginInline origin={origin} className="mt-0.5 max-w-full" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex shrink-0 items-center gap-1">
            <IconButton label="Música anterior" size="icon-sm" onClick={onPrev} disabled={!hasPrev}>
              <SkipBack fill="currentColor" />
            </IconButton>
            <Button variant="primary" size="icon" aria-label={playing ? "Pausar" : "Tocar"} onClick={toggle}>
              {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="translate-x-px" />}
            </Button>
            <IconButton label="Próxima música" size="icon-sm" onClick={onNext}>
              <SkipForward fill="currentColor" />
            </IconButton>
          </div>
          <span className="w-10 shrink-0 text-right text-caption tabular text-text-2 tracking-normal">{formatTime(position)}</span>
          <Waveform song={song} position={position} duration={duration} onSeek={seek} className="h-10 sm:h-10" />
          <span className="w-10 shrink-0 text-caption tabular text-text-2 tracking-normal">{formatTime(duration)}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <IconButton label="Abrir tocando agora" size="icon-sm" onClick={onExpand}>
            <Maximize2 />
          </IconButton>
          <IconButton label="Fechar player" size="icon-sm" onClick={onClose}>
            <X />
          </IconButton>
          {kind === "premium" ? (
            <VolumeControl volume={engine.volume} onChange={engine.setVolume} />
          ) : (
            <div className="relative w-72">
              {/* espaço do player oficial do Spotify (posicionado pelo motor) */}
              <div className="h-20" />
              {needsTap && (
                <p role="status" className="absolute -top-7 right-0 rounded-xs bg-surface-1 px-2 py-1 text-caption font-semibold text-ai shadow-2 tracking-normal">
                  Clique no ▶ do Spotify para liberar o som
                </p>
              )}
              {onConnect && (
                <button
                  type="button"
                  onClick={onConnect}
                  className="absolute -top-6 left-0 text-caption font-semibold text-brand tracking-normal hover:underline"
                >
                  Ouvir inteira com Spotify Premium
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Celular: mini-player */}
      <section
        aria-label="Player"
        className="fixed inset-x-2 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 overflow-hidden rounded-md bg-(--glass-bg) shadow-3 ring-1 ring-(--glass-ring) backdrop-blur-(--glass-blur) md:hidden"
      >
        <div className="flex items-center gap-3 p-2">
          <button type="button" onClick={onExpand} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Abrir tocando agora">
            <Cover song={song} className="size-11 shrink-0 rounded-sm" />
            <span className="min-w-0">
              <span className="block truncate text-small font-semibold text-text-1">{cleanTitle(song.track_name)}</span>
              {origin ? (
                <AiOriginInline origin={origin} className="max-w-full" />
              ) : (
                <span className="block truncate text-caption text-text-2 tracking-normal">{formatArtists(song.artists)}</span>
              )}
            </span>
          </button>
          <Button variant="primary" size="icon" aria-label={playing ? "Pausar" : "Tocar"} onClick={toggle}>
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="translate-x-px" />}
          </Button>
          <IconButton label="Próxima música" size="icon-sm" onClick={onNext}>
            <SkipForward fill="currentColor" />
          </IconButton>
        </div>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-(--glass-track)">
          <span className="block h-full bg-brand" style={{ width: `${pct}%` }} />
        </span>
        {needsTap && (
          <button type="button" onClick={onExpand} className="block w-full bg-ai-surface px-3 py-1.5 text-left text-caption font-semibold text-ai tracking-normal">
            Toque aqui e depois no ▶ do Spotify para liberar o som
          </button>
        )}
      </section>
    </>
  );
}

function VolumeControl({ volume, onChange }) {
  // Guarda o último volume com som, para o botão de mudo voltar nele.
  const lastAudible = useRef(volume > 0 ? volume : 80);
  if (volume > 0) lastAudible.current = volume;
  const muted = volume === 0;
  const Icon = muted ? VolumeX : volume < 50 ? Volume1 : Volume2;

  // O número (0 a 100) só aparece enquanto a pessoa ajusta o volume.
  const [adjusting, setAdjusting] = useState(false);
  const dragging = useRef(false);
  const hideTimer = useRef(null);
  const reduce = useReducedMotion();

  const show = () => {
    clearTimeout(hideTimer.current);
    setAdjusting(true);
  };
  const hideSoon = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => !dragging.current && setAdjusting(false), 700);
  };

  useEffect(() => {
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      hideSoon();
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Centro do botão do slider: o Radix mantém o botão (0,875rem) dentro da trilha.
  const left = `calc(${volume}% + (0.5 - ${volume / 100}) * 0.875rem)`;

  return (
    <span className="flex w-44 items-center gap-1 text-text-2">
      <IconButton
        label={muted ? "Ativar som" : "Silenciar"}
        size="icon-sm"
        aria-pressed={muted}
        onClick={() => onChange(muted ? lastAudible.current : 0)}
        className={muted ? "text-text-1" : undefined}
      >
        <Icon />
      </IconButton>
      <span
        className="relative flex flex-1 items-center"
        onPointerDown={() => {
          dragging.current = true;
          show();
        }}
      >
        <Slider
          size="sm"
          value={[volume]}
          onValueChange={([v]) => {
            onChange(v);
            show();
            if (!dragging.current) hideSoon();
          }}
          aria-label="Volume"
          aria-valuetext={`${volume} de 100`}
          tone="brand"
        />
        <AnimatePresence>
          {adjusting && (
            <motion.span
              aria-hidden="true"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.9 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-sm bg-surface-3 px-2 py-0.5 text-caption font-semibold tabular text-text-1 tracking-normal shadow-2"
              style={{ left }}
            >
              {volume}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </span>
  );
}
