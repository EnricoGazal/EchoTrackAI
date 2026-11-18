import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatTime } from "../../utils";
import { cn } from "../../lib/utils";
import { waveformFor } from "./signature";

const BAR = { desktop: { width: 4, gap: 3 }, mobile: { width: 3, gap: 2 } };
const STEP = 5000; // setas: 5 s
const BIG_STEP = 15000; // Shift + setas / Page Up/Down: 15 s

/**
 * A forma de onda É a linha do tempo: o que já tocou fica esmaecido e mais
 * baixo; o que vai tocar fica em destaque. Clique, arraste ou use as setas.
 */
export function Waveform({ song, position, duration, onSeek, className }) {
  const ref = useRef(null);
  const [count, setCount] = useState(96);
  const [drag, setDrag] = useState(null); // posição (ms) enquanto arrasta
  const [hover, setHover] = useState(null); // 0–1 com o mouse em cima
  const reduce = useReducedMotion();

  // Quantidade de barras conforme a largura disponível.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const { width, gap } = w < 520 ? BAR.mobile : BAR.desktop;
      setCount(Math.max(24, Math.floor((w + gap) / (width + gap))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bars = waveformFor(song, count);
  const shown = drag ?? position;
  const progress = duration ? Math.min(1, Math.max(0, shown / duration)) : 0;

  const ratioAt = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  function onPointerDown(e) {
    if (!duration || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(ratioAt(e.clientX) * duration);
  }
  function onPointerMove(e) {
    const ratio = ratioAt(e.clientX);
    if (e.pointerType === "mouse") setHover(ratio);
    if (drag != null) setDrag(ratio * duration);
  }
  function onPointerUp(e) {
    if (drag == null) return;
    const ms = ratioAt(e.clientX) * duration;
    setDrag(null);
    onSeek?.(ms);
  }

  function onKeyDown(e) {
    if (!duration) return;
    const big = e.shiftKey ? BIG_STEP : STEP;
    const moves = {
      ArrowRight: position + big,
      ArrowUp: position + big,
      ArrowLeft: position - big,
      ArrowDown: position - big,
      PageUp: position + BIG_STEP,
      PageDown: position - BIG_STEP,
      Home: 0,
      End: duration - 1000,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    onSeek?.(Math.min(duration - 1000, Math.max(0, moves[e.key])));
  }

  // Sai do modo "arrastando" se a música trocar no meio do gesto.
  useEffect(() => setDrag(null), [song.track_id]);

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Posição na música"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration / 1000)}
      aria-valuenow={Math.round(shown / 1000)}
      aria-valuetext={`${formatTime(shown)} de ${formatTime(duration)}`}
      aria-disabled={!duration}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      className={cn(
        "group relative flex h-20 w-full cursor-pointer touch-none items-center justify-between sm:h-28",
        "rounded-sm focus-visible:outline-offset-8",
        className
      )}
    >
      {bars.map((h, i) => {
        const center = (i + 0.5) / bars.length;
        const played = center < progress;
        const hovered = hover != null && center >= progress && center <= hover;
        return (
          // A camada de fora desenha a onda da esquerda para a direita
          // quando a música troca; a de dentro mostra se já tocou.
          <motion.span
            key={`${song.track_id}-${i}`}
            aria-hidden="true"
            className="flex h-full flex-1 items-center justify-center"
            initial={reduce ? false : { scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.36, delay: i * 0.006, ease: [0.22, 1, 0.36, 1] }}
          >
            <span
              className={cn(
                "block w-full max-w-1 rounded-pill bg-text-1",
                "transition-[transform,opacity,background-color] duration-(--duration-slow) ease-out",
                played && "scale-x-[0.6] scale-y-[0.55] opacity-35",
                hovered && "bg-brand"
              )}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          </motion.span>
        );
      })}

      {/* Ponto de reprodução */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 w-0.5 -translate-x-1/2 rounded-pill bg-brand shadow-2 transition-[left] duration-(--duration-base) ease-linear"
        style={{ left: `${progress * 100}%` }}
      />

      {/* Prévia do tempo ao passar o mouse */}
      {hover != null && duration > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-xs bg-surface-3 px-1.5 py-0.5 text-caption tabular text-text-1 shadow-2"
          style={{ left: `${hover * 100}%` }}
        >
          {formatTime(hover * duration)}
        </span>
      )}
    </div>
  );
}
