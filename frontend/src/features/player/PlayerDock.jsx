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
  const Icon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  return (
    <span className="flex w-40 items-center gap-2 text-text-2">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <Slider value={[volume]} onValueChange={([v]) => onChange(v)} aria-label="Volume" tone="brand" />
    </span>
  );
}
