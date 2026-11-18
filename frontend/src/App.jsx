import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import { deleteAccount, getHealth, getMe, getRadio, getToken, logout, prefetchRadio, setToken } from "./api";
import * as spotify from "./spotify";
import { useRouter } from "./lib/router";
import { rememberTrack } from "./lib/library";
import { AppContext } from "./features/shell/context";
import { BottomNav, MobileTopBar, Sidebar } from "./features/shell/Navigation";
import { CommandSearch } from "./features/shell/CommandSearch";
import { UserMenu } from "./features/shell/UserMenu";
import { EmbedEngine, loadSpotifyApi } from "./features/player/EmbedEngine";
import { SdkEngine } from "./features/player/SdkEngine";
import { PlayerDock } from "./features/player/PlayerDock";
import { useLivePosition } from "./features/player/useLivePosition";
import { NowPlaying } from "./features/now-playing/NowPlaying";
import { listName, originFor } from "./features/ai/origin";
import { AuthPage } from "./pages/AuthPage";
import { Onboarding } from "./pages/Onboarding";
import { HomePage } from "./pages/HomePage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { SongPage } from "./pages/SongPage";
import { GenrePage } from "./pages/GenrePage";
import { ArtistPage } from "./pages/ArtistPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LibraryPage } from "./pages/LibraryPage";
import { Confirm } from "./ui/confirm";
import { Notice } from "./ui/section";
import { Button } from "./ui/button";
import { Logo } from "./ui/logo";

// Fluxo de entrada: login, questionário e, por fim, o app.
export default function App() {
  const [stage, setStage] = useState("loading"); // loading | auth | onboarding | app | offline
  const [user, setUser] = useState(null);

  async function loadUser() {
    if (!getToken()) {
      setStage("auth");
      return;
    }
    setStage("loading");
    try {
      const me = await getMe();
      setUser(me);
      setStage(me.onboarded ? "app" : "onboarding");
    } catch (err) {
      if (err.kind === "offline") setStage("offline");
      else {
        setToken(null);
        setStage("auth");
      }
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  const toaster = (
    <Toaster
      theme="dark"
      position="top-center"
      toastOptions={{
        className: "!bg-(--glass-bg) !text-text-1 !ring-1 !ring-(--glass-ring) !border-0 !backdrop-blur-(--glass-blur) !shadow-3 !rounded-md !font-sans",
      }}
    />
  );

  if (stage === "loading")
    return (
      <div className="grid min-h-dvh place-items-center">
        <Logo className="animate-pulse" />
      </div>
    );
  if (stage === "offline")
    return (
      <div className="mx-auto grid min-h-dvh max-w-lg place-items-center px-4">
        <Notice
          tone="danger"
          title="O EchoTrack não conseguiu falar com o modelo"
          action={<Button variant="primary" onClick={loadUser}>Tentar de novo</Button>}
        >
          Confira se a API está rodando (uvicorn app.main:app --reload).
        </Notice>
      </div>
    );
  if (stage === "auth")
    return (
      <>
        {toaster}
        <AuthPage
          onAuth={(u) => {
            setUser(u);
            setStage(u.onboarded ? "app" : "onboarding");
          }}
        />
      </>
    );
  if (stage === "onboarding")
    return (
      <Onboarding
        name={user.name}
        onDone={(profile) => {
          setUser((u) => ({ ...u, onboarded: true, profile }));
          window.history.replaceState({ hint: { firstTime: true } }, "", "/perfil");
          setStage("app");
        }}
      />
    );

  return (
    <>
      {toaster}
      <MainApp
        user={user}
        setUser={setUser}
        onRedo={() => setStage("onboarding")}
        onSignedOut={() => {
          setToken(null);
          setUser(null);
          window.history.replaceState({}, "", "/");
          setStage("auth");
        }}
      />
    </>
  );
}

function MainApp({ user, setUser, onRedo, onSignedOut }) {
  const { route, hint, navigate } = useRouter();

  // --- Saúde da API -------------------------------------------------------
  const [health, setHealth] = useState({ state: "checking" });
  const checkHealth = useCallback(async () => {
    setHealth({ state: "checking" });
    try {
      const d = await getHealth();
      setHealth(d.status === "ok" ? { state: "ok", ...d } : { state: "not_loaded" });
    } catch {
      setHealth({ state: "offline" });
    }
  }, []);
  useEffect(() => {
    checkHealth();
    loadSpotifyApi(); // o player do Spotify já fica pronto para o primeiro clique
  }, [checkHealth]);

  // --- Spotify Premium ------------------------------------------------------
  const [spotifyStatus, setSpotifyStatus] = useState(() =>
    !spotify.isConfigured() ? "unconfigured" : spotify.isConnected() ? "connecting" : "off"
  );
  useEffect(() => {
    const err = spotify.consumeError();
    if (err) toast.error(err);
  }, []);
  useEffect(() => {
    if (spotifyStatus !== "connecting") return;
    spotify
      .connectPlayer()
      .then(() => setSpotifyStatus("ready"))
      .catch((err) => {
        if (err.kind === "premium") toast("Sua conta do Spotify não é Premium: as músicas seguem em prévias de 30 segundos.");
        else {
          spotify.disconnect();
          toast("A conexão com o Spotify expirou. Conecte de novo pelo menu da sua conta.");
        }
        setSpotifyStatus("off");
      });
  }, [spotifyStatus]);
  const canConnect = spotifyStatus === "off";

  // --- Player ---------------------------------------------------------------
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [request, setRequest] = useState(0);
  const [paused, setPaused] = useState(true);
  const [listOrigin, setListOrigin] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const played = useRef(new Set());
  const current = index >= 0 ? queue[index] : null;

  const play = useCallback(
    (list, i = 0, origin = null) => {
      spotify.activate(); // libera o áudio do Spotify (precisa ser no clique)
      const song = list[i];
      if (!song) return;
      setQueue(list);
      setIndex(i);
      if (origin) setListOrigin(origin);
      played.current.add(song.track_id);
      rememberTrack(song);
      setRequest((n) => n + 1);
    },
    []
  );

  // Tocar/pausar uma música de qualquer tela: se já é a atual, alterna.
  const playFrom = useCallback(
    (list, i, origin) => {
      const song = list[i];
      if (current && song && song.track_id === current.track_id) {
        spotify.activate();
        setRequest((n) => n + 1);
        return;
      }
      play(list, i, origin);
    },
    [current, play]
  );

  const goTo = (i) => {
    if (i < 0 || i >= queue.length) return;
    play(queue, i);
  };

  // Próxima. Quando a fila acaba, o modelo continua a partir da música atual
  // (modo rádio). Esse rádio já foi pré-carregado, então não há espera.
  async function playNext() {
    if (index + 1 < queue.length) {
      goTo(index + 1);
      return;
    }
    if (!current) return;
    try {
      const d = await getRadio(current.track_id, { n: 10 });
      const radioOrigin = { kind: "radio", seed: d.seed };
      const fresh = d.recommendations
        .filter((s) => !played.current.has(s.track_id) && !queue.some((q) => q.track_id === s.track_id))
        .map((s) => ({ ...s, _origin: radioOrigin }));
      if (fresh.length) play([...queue, ...fresh], queue.length);
    } catch {
      /* sem recomendação: o player só para */
    }
  }

  useEffect(() => {
    if (current && index >= queue.length - 2) prefetchRadio(current.track_id, { n: 10 });
  }, [current, index, queue.length]);

  function closePlayer() {
    setIndex(-1);
    setQueue([]);
    setPaused(true);
    setExpanded(false);
  }

  // --- Busca (⌘K) e seletor de música --------------------------------------
  const [search, setSearch] = useState({ open: false, pick: null, title: "Buscar" });
  const openSearch = useCallback(() => setSearch({ open: true, pick: null, title: "Buscar" }), []);
  const pickSong = useCallback((title, onPick) => setSearch({ open: true, pick: onPick, title }), []);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => (s.open ? { ...s, open: false } : { open: true, pick: null, title: "Buscar" }));
      } else if (e.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName || "") && !document.activeElement?.isContentEditable) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch]);

  // --- Conta -----------------------------------------------------------------
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function signOut() {
    try {
      await logout();
    } catch {
      /* mesmo sem resposta, a sessão local é encerrada */
    }
    onSignedOut();
  }
  async function removeAccount() {
    await deleteAccount();
    onSignedOut();
  }

  const openSong = useCallback((song) => navigate({ name: "song", id: song.track_id }, { hint: { song } }), [navigate]);
  const openArtist = useCallback((name) => navigate({ name: "artist", artist: name }), [navigate]);
  const openGenre = useCallback((g) => navigate({ name: "genre", id: g.genre }, { hint: { label: g.label } }), [navigate]);

  const ctx = useMemo(
    () => ({
      user,
      setUser,
      route,
      hint,
      navigate,
      health,
      current,
      paused: paused || !current,
      playFrom,
      openSong,
      openArtist,
      openGenre,
      openSearch,
      pickSong,
      onRedo,
    }),
    [user, setUser, route, hint, navigate, health, current, paused, playFrom, openSong, openArtist, openGenre, openSearch, pickSong, onRedo]
  );

  const account = (compact) => (
    <UserMenu
      name={user.name}
      compact={compact}
      side={compact ? "bottom" : "top"}
      align={compact ? "end" : "start"}
      spotify={spotifyStatus}
      onProfile={() => navigate({ name: "profile" })}
      onRedo={onRedo}
      onConnect={canConnect ? spotify.startLogin : null}
      onDisconnect={spotifyStatus === "ready" || spotifyStatus === "connecting" ? () => { spotify.disconnect(); setSpotifyStatus("off"); } : null}
      onLogout={signOut}
      onDelete={() => setConfirmDelete(true)}
    />
  );

  const Page = { home: HomePage, discover: DiscoverPage, song: SongPage, genre: GenrePage, artist: ArtistPage, profile: ProfilePage, library: LibraryPage }[route.name] || HomePage;
  const activeNav = ["home", "discover", "profile", "library"].includes(route.name) ? route.name : route.name === "genre" ? "discover" : null;

  const engineProps = {
    song: current,
    request,
    onNext: playNext,
    onPausedChange: setPaused,
  };
  const renderPlayer = (api) => (
    <PlayerUi
      api={api}
      song={current}
      queue={queue}
      index={index}
      listOrigin={listOrigin}
      expanded={expanded}
      setExpanded={setExpanded}
      onPrev={() => goTo(index - 1)}
      onNext={playNext}
      onPick={(s) => goTo(queue.indexOf(s))}
      onClose={closePlayer}
      onArtist={(a) => {
        setExpanded(false);
        openArtist(a);
      }}
      onConnect={canConnect ? spotify.startLogin : null}
    />
  );

  return (
    <AppContext.Provider value={ctx}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-sm focus:bg-surface-2 focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <Sidebar active={activeNav} onNavigate={navigate} health={health} account={account(false)} />
      <MobileTopBar onNavigate={navigate} onSearch={openSearch} account={account(true)} />

      <main id="conteudo" className={`min-h-dvh md:pl-64 ${current ? "pb-44 md:pb-32" : "pb-24 md:pb-12"}`}>
        {health.state === "offline" && (
          <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-8">
            <Notice tone="danger" title="Sem conexão com o modelo" action={<Button onClick={checkHealth}>Tentar de novo</Button>}>
              A API parou de responder. Confira o terminal do uvicorn.
            </Notice>
          </div>
        )}
        <Page key={route.name === "song" || route.name === "genre" || route.name === "artist" ? undefined : route.name} />
      </main>

      <BottomNav active={activeNav} onNavigate={navigate} />

      {current &&
        (spotifyStatus === "ready" ? (
          <SdkEngine
            {...engineProps}
            onError={(err) => {
              toast(`O Spotify não conseguiu tocar a música inteira (${err.message}). Voltando para a prévia.`);
              setSpotifyStatus("off");
            }}
          >
            {renderPlayer}
          </SdkEngine>
        ) : (
          <EmbedEngine {...engineProps} placement={expanded ? "expanded" : "dock"}>
            {renderPlayer}
          </EmbedEngine>
        ))}

      <CommandSearch
        open={search.open}
        title={search.title}
        pickSong={search.pick}
        onOpenChange={(open) => setSearch((s) => ({ ...s, open }))}
        onSong={openSong}
        onArtist={openArtist}
        onGenre={openGenre}
        onAction={(a) => a === "bridge" && navigate({ name: "discover" })}
      />
      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Apagar sua conta?"
        description="Sua conta e todas as respostas do questionário serão apagadas. Isso não pode ser desfeito."
        confirmLabel="Apagar conta"
        onConfirm={removeAccount}
      />
    </AppContext.Provider>
  );
}

function PlayerUi({ api, song, queue, index, listOrigin, expanded, setExpanded, onPrev, onNext, onPick, onClose, onArtist, onConnect }) {
  const position = useLivePosition(api.playback);
  const duration = api.playback.duration || song.duration_ms || 0;
  const origin = originFor(song, song._origin || listOrigin);
  const upNext = queue.slice(index + 1, index + 4);

  // Safari: se o navegador pedir um clique no player do Spotify, abre a tela
  // cheia (onde o player aparece com o aviso) no celular.
  useEffect(() => {
    if (api.needsTap && window.matchMedia("(max-width: 767px)").matches) setExpanded(true);
  }, [api.needsTap, setExpanded]);

  return (
    <>
      <PlayerDock
        song={song}
        origin={origin}
        engine={api}
        position={position}
        hasPrev={index > 0}
        onPrev={onPrev}
        onNext={() => onNext()}
        onExpand={() => setExpanded(true)}
        onClose={onClose}
        onConnect={onConnect}
      />
      <AnimatePresence>
        {expanded && (
          <NowPlaying
            key="now-playing"
            song={song}
            origin={origin}
            listName={listName(song._origin || listOrigin)}
            upNext={upNext}
            playing={!api.playback.paused}
            position={position}
            duration={duration}
            hasPrev={index > 0}
            onToggle={api.toggle}
            onSeek={api.seek}
            onPrev={onPrev}
            onNext={() => onNext()}
            onPickNext={onPick}
            onArtist={onArtist}
            onMinimize={() => setExpanded(false)}
            reserveEmbed={api.kind === "preview"}
            needsTap={api.needsTap}
          />
        )}
      </AnimatePresence>
    </>
  );
}
