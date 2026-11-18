import { useEffect, useRef, useState } from "react";
import { onStateChange, playTrack, seek, setVolume, togglePlay } from "../../spotify";

/*
 * Motor Premium: toca a música inteira dentro do EchoTrack com a conta
 * Spotify conectada (Web Playback SDK). Entrega o mesmo estado e os mesmos
 * comandos do motor de prévia, então a interface é igual.
 */
export function SdkEngine({ song, request, onNext, onPausedChange, onError, children }) {
  const [playback, setPlayback] = useState({ position: 0, duration: 0, paused: true, at: 0 });
  const [volume, setVol] = useState(80);
  const current = useRef(null); // id da música que mandamos tocar
  const last = useRef(null);
  const endedFor = useRef(null);
  const handled = useRef(null); // último pedido já atendido (o StrictMode roda efeitos duas vezes)
  const callbacks = useRef({});
  callbacks.current = { onNext, onPausedChange };

  // Estado vindo do Spotify: posição, duração, pausado e fim da música.
  useEffect(
    () =>
      onStateChange((state) => {
        if (!state) return;
        const track = state.track_window.current_track;
        const prev = last.current;
        last.current = state;
        setPlayback({ position: state.position, duration: state.duration, paused: state.paused, at: performance.now() });
        callbacks.current.onPausedChange?.(state.paused);

        // Fim da música: o Spotify volta para 0, pausa e põe a faixa em "anteriores".
        const finished =
          state.paused && state.position === 0 && state.track_window.previous_tracks.some((t) => t.id === track?.id);
        const reachedEnd =
          state.paused && prev && !prev.paused && state.duration > 0 && state.position >= state.duration - 1500;
        if ((finished || reachedEnd) && track && endedFor.current !== track.id && track.id === current.current) {
          endedFor.current = track.id;
          callbacks.current.onNext?.({ auto: true });
        }
      }),
    []
  );

  // Cada clique em "ouvir": a mesma música alterna tocar/pausar; outra troca de faixa.
  useEffect(() => {
    if (handled.current === request) return;
    handled.current = request;
    if (song.track_id === current.current) {
      togglePlay();
      return;
    }
    current.current = song.track_id;
    endedFor.current = null;
    setPlayback({ position: 0, duration: song.duration_ms || 0, paused: true, at: performance.now() });
    playTrack(song.track_id).catch((err) => onError?.(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  return children({
    kind: "premium",
    playback,
    toggle: () => togglePlay(),
    seek: (ms) => {
      seek(ms);
      setPlayback((p) => ({ ...p, position: ms, at: performance.now() }));
    },
    needsTap: false,
    volume,
    setVolume: (v) => {
      setVol(v);
      setVolume(v / 100);
    },
  });
}
