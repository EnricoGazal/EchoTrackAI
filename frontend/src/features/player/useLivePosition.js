import { useEffect, useState } from "react";

/** Posição atual (ms), avançando entre as atualizações do Spotify. */
export function useLivePosition(playback) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (playback.paused) return undefined;
    const id = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(id);
  }, [playback.paused, playback.at]);
  if (playback.paused) return playback.position;
  const live = playback.position + Math.max(0, now - playback.at);
  return playback.duration ? Math.min(playback.duration, live) : live;
}
