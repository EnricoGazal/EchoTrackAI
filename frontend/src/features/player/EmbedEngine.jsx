import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { getEmbedSlot } from "./embedSlot";

// Carrega uma única vez o iFrame API do Spotify, que permite controlar o
// player pelo código (tocar, pausar, trocar de música, avançar).
let apiPromise = null;
export function loadSpotifyApi() {
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      window.onSpotifyIframeApiReady = (IFrameAPI) => resolve(IFrameAPI);
      const script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      document.body.appendChild(script);
    });
  }
  return apiPromise;
}

const toUri = (song) => `spotify:track:${song.track_id}`;

// Onde o player oficial do Spotify aparece. É o mesmo elemento sempre (trocar
// de lugar no DOM recarregaria o player); só muda a posição na tela.
const PLACEMENT = {
  dock: "bottom-[calc(var(--rail-gap)+var(--space))] right-[calc(var(--rail-gap)+var(--space)*4)] w-72 max-md:left-0 max-md:top-full max-md:bottom-auto",
  expanded: "", // posição vem do espaço reservado na tela cheia (ver efeito abaixo)
};

/*
 * Motor da prévia (player embutido do Spotify, 30 s). Não desenha a barra:
 * entrega o estado e os comandos para `children`, que monta a interface.
 *
 * `request` muda a cada clique em "ouvir": se for a mesma música, alterna
 * entre tocar e pausar; se for outra, troca e começa a tocar.
 */
export function EmbedEngine({
  song,
  request,
  onNext,
  onPausedChange,
  placement = "dock",
  children,
}) {
  const hostRef = useRef(null);
  const frameRef = useRef(null);

  // Na tela cheia, o player acompanha o espaço reservado para ele (inclusive
  // durante a animação de abrir e ao rolar a tela).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    if (placement !== "expanded") {
      frame.style.cssText = "";
      return undefined;
    }
    let raf;
    const follow = () => {
      const slot = getEmbedSlot();
      if (slot) {
        const r = slot.getBoundingClientRect();
        frame.style.top = `${r.top}px`;
        frame.style.left = `${r.left}px`;
        frame.style.width = `${r.width}px`;
        frame.style.bottom = "auto";
        frame.style.right = "auto";
        frame.style.visibility = "visible";
      } else {
        frame.style.visibility = "hidden";
      }
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => {
      cancelAnimationFrame(raf);
      frame.style.cssText = "";
    };
  }, [placement]);
  const controllerRef = useRef(null);
  const currentUri = useRef(null);
  const pendingUri = useRef(null); // música que ainda precisa começar a tocar
  const endedFor = useRef(null); // evita avançar duas vezes no fim da música
  const last = useRef(null); // última atualização recebida do Spotify
  const userActionAt = useRef(0); // hora do último clique em tocar/pausar/pular
  const callbacks = useRef({});
  callbacks.current = { onNext, onPausedChange };

  // Estado da reprodução vindo do Spotify (posição e duração em ms).
  const [playback, setPlayback] = useState({ position: 0, duration: 0, paused: true, at: 0 });

  // O Safari não deixa o site dar "play" dentro do player do Spotify sem um
  // clique direto nele. Se a música não começar logo depois de um pedido,
  // mostramos um aviso pedindo um clique no botão do próprio Spotify.
  const [needsTap, setNeedsTap] = useState(false);
  const startWatch = useRef(null);
  function watchStart() {
    clearTimeout(startWatch.current);
    startWatch.current = setTimeout(() => {
      if (!last.current || last.current.isPaused) setNeedsTap(true);
    }, 2500);
  }
  useEffect(() => () => clearTimeout(startWatch.current), []);

  // Cria o player na primeira vez que ele aparece.
  useEffect(() => {
    let cancelled = false;
    const uri = toUri(song);
    currentUri.current = uri;
    pendingUri.current = uri;

    loadSpotifyApi().then((IFrameAPI) => {
      if (cancelled || !hostRef.current) return;
      const target = document.createElement("div");
      hostRef.current.appendChild(target);
      IFrameAPI.createController(target, { uri, width: "100%", height: 80 }, (controller) => {
        if (cancelled) {
          controller.destroy();
          return;
        }
        controllerRef.current = controller;
        controller.addListener("ready", () => {
          if (pendingUri.current) {
            controller.play();
            watchStart();
          }
        });
        controller.addListener("playback_update", (e) => {
          const { isPaused, playingURI, position, duration } = e.data;
          const prev = last.current;
          last.current = { isPaused, position, uri: playingURI };
          if (!isPaused) {
            clearTimeout(startWatch.current);
            setNeedsTap(false);
          }
          if (!isPaused && playingURI === pendingUri.current) pendingUri.current = null;
          setPlayback({ position, duration, paused: isPaused, at: performance.now() });
          callbacks.current.onPausedChange?.(isPaused);

          // Fim da música (inteira ou da prévia de 30 s): toca a próxima.
          // A prévia para por volta dos 30 s, mas o Spotify continua
          // informando a duração da música inteira; por isso há três testes.
          const stoppedByItself =
            isPaused &&
            prev && !prev.isPaused && prev.uri === playingURI &&
            !pendingUri.current &&
            performance.now() - userActionAt.current > 1500;
          const ended =
            isPaused && duration > 0 && position >= duration - 1500 ||
            stoppedByItself && position >= 28000 && position <= 31500 ||
            stoppedByItself && position === 0 && prev.position >= 28000;
          if (ended && endedFor.current !== playingURI) {
            endedFor.current = playingURI;
            callbacks.current.onNext?.({ auto: true });
          }
        });
      });
    });

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
    // Criado só uma vez; as trocas de música passam pelo efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada clique em "ouvir" (ou anterior/próxima) depois que o player já existe.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const uri = toUri(song);

    if (uri === currentUri.current && !pendingUri.current) {
      userActionAt.current = performance.now();
      controller.togglePlay();
      if (!last.current || last.current.isPaused) watchStart();
      return;
    }

    userActionAt.current = performance.now();
    currentUri.current = uri;
    pendingUri.current = uri;
    endedFor.current = null;
    last.current = null;
    setPlayback({ position: 0, duration: 0, paused: true, at: performance.now() });
    controller.loadUri(uri);
    controller.play();
    watchStart();

    // Alguns navegadores ignoram o primeiro play enquanto a música carrega.
    const retry = setTimeout(() => {
      if (pendingUri.current === uri) controller.play();
    }, 900);
    return () => clearTimeout(retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  function togglePlay() {
    const controller = controllerRef.current;
    if (!controller) return;
    userActionAt.current = performance.now();
    const wasPaused = !last.current || last.current.isPaused;
    if (pendingUri.current) controller.play();
    else controller.togglePlay();
    if (wasPaused) watchStart();
    else setNeedsTap(false);
  }

  function seekTo(ms) {
    userActionAt.current = performance.now();
    controllerRef.current?.seek(Math.floor(ms / 1000));
    setPlayback((p) => ({ ...p, position: ms, at: performance.now() }));
  }

  return (
    <>
      <div
        ref={frameRef}
        role="region"
        aria-label="Player do Spotify"
        className={cn(
          "fixed z-[60] h-20 overflow-hidden rounded-md shadow-3 transition-[opacity] duration-(--duration-base)",
          PLACEMENT[placement],
          needsTap && "ring-2 ring-ai"
        )}
      >
        <div ref={hostRef} className="size-full" />
      </div>
      {children({
        kind: "preview",
        playback,
        toggle: togglePlay,
        seek: seekTo,
        needsTap,
      })}
    </>
  );
}
