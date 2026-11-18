import { useEffect, useMemo, useState } from "react";
import { ChevronDown, GitCompareArrows, Pause, Play } from "lucide-react";
import { getRadio } from "../api";
import { rememberPlaylist } from "../lib/library";
import { useApp } from "../features/shell/context";
import { Cover } from "../ui/cover";
import { Button } from "../ui/button";
import { Notice } from "../ui/section";
import { Skeleton } from "../ui/skeleton";
import { AiMark } from "../features/ai/AiLayer";
import { TrackList } from "../features/tracks/TrackList";
import { PlaylistHero, Dot } from "../features/radio/PlaylistHero";
import { DEFAULT_LAMBDA, SteerPanel, lambdaFromVariety, varietyFromLambda } from "../features/radio/SteerPanel";
import { statusText, useSteeredList } from "../features/radio/useSteeredList";
import { cleanTitle, splitArtists } from "../utils";
import { cn } from "../lib/utils";

const INITIAL = { steer: { energy: 0, acousticness: 0, valence: 0 }, variety: varietyFromLambda(DEFAULT_LAMBDA), obscure: false };
const SIZES = [10, 20, 30];

/** Playlist a partir de uma música, com o rádio dirigível. */
export function SongPage() {
  const { route, hint, playFrom, current, paused, openArtist, openSong, navigate } = useApp();
  const id = route.id;
  const start = hint?.obscure ? { ...INITIAL, obscure: true } : INITIAL;
  const [controls, setControls] = useState(start);
  const [n, setN] = useState(10);
  const [panelOpen, setPanelOpen] = useState(Boolean(hint?.obscure));

  // Música nova: controles voltam ao original (ou já "fora da bolha", se pedido).
  useEffect(() => setControls(start), [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const opts = useMemo(
    () => ({ n, lam: lambdaFromVariety(controls.variety), steer: controls.steer, obscure: controls.obscure }),
    [n, controls]
  );
  const key = JSON.stringify([id, opts]);
  const list = useSteeredList((o) => getRadio(id, opts, o), key);
  useEffect(() => list.resetDiff(), [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = list.data && list.data.seed.track_id === id ? list.data : null;
  const seed = data?.seed ?? (hint?.song?.track_id === id ? hint.song : null);
  const items = data?.recommendations ?? [];

  useEffect(() => {
    if (data) rememberPlaylist({ kind: "song", id, title: cleanTitle(data.seed.track_name), subtitle: splitArtists(data.seed.artists).join(", "), cover: id });
  }, [data, id]);

  const origin = seed ? { kind: "seed", seed } : null;
  const listPlaying = current && items.some((s) => s.track_id === current.track_id) && !paused;
  const seedPlaying = current?.track_id === id && !paused;
  const avgPop = items.length ? Math.round(items.reduce((a, s) => a + s.popularity, 0) / items.length) : null;

  if (list.error && !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <Notice tone="danger" title="Não foi possível montar esta playlist">{list.error.message}</Notice>
      </div>
    );
  }

  const panel = (
    <SteerPanel
      value={controls}
      onChange={setControls}
      onReset={() => setControls(INITIAL)}
      seed={seed}
      target={data?.target}
      status={{
        loading: list.loading,
        text: statusText(list) + (avgPop != null && !list.loading ? ` Popularidade média: ${avgPop}/100.` : ""),
      }}
    />
  );

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-7xl gap-10 px-4 py-8 sm:px-8 sm:py-12">
      {seed ? (
        <PlaylistHero
          art={<Cover song={seed} className="w-full rounded-md shadow-3" alt={`Capa de ${seed.album_name || seed.track_name}`} />}
          kicker={<AiMark>Rádio a partir desta música</AiMark>}
          title={cleanTitle(seed.track_name)}
          meta={
            <>
              <span className="font-semibold text-text-1">
                {splitArtists(seed.artists).map((a, i) => (
                  <span key={a}>
                    {i > 0 && ", "}
                    <button type="button" className="inline-flex min-h-6 items-center hover:underline" onClick={() => openArtist(a)}>{a}</button>
                  </span>
                ))}
              </span>
              {seed.album_name && (<><Dot /><span className="truncate">{seed.album_name}</span></>)}
              {seed.genre_group && (<><Dot /><span>{seed.genre_group}</span></>)}
              {seed.tempo != null && (<><Dot /><span className="tabular">{Math.round(seed.tempo)} BPM</span></>)}
            </>
          }
          actions={
            <>
              <Button variant="primary" size="lg" disabled={!items.length} onClick={() => playFrom(items, 0, origin)}>
                {listPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                {listPlaying ? "Pausar" : "Tocar a playlist"}
              </Button>
              <Button size="lg" onClick={() => playFrom([seed], 0, null)}>
                {seedPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                {seedPlaying ? "Pausar" : "Ouvir só esta"}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => navigate({ name: "discover", from: id })}>
                <GitCompareArrows aria-hidden="true" /> Criar ponte a partir desta
              </Button>
            </>
          }
        />
      ) : (
        <div className="flex gap-8">
          <Skeleton className="size-40 rounded-md sm:size-52" />
          <div className="grid flex-1 content-end gap-3">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-14 w-3/4" />
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section aria-labelledby="lista" aria-busy={list.loading} className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="lista" className="font-display-wide text-title font-semibold">A playlist</h2>
              <p className="mt-1 text-small text-text-2">
                Afinidade = quanto o som de cada música se parece com o de{" "}
                <span className="text-text-1">{seed ? cleanTitle(seed.track_name) : "…"}</span>.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-pill bg-surface-1 p-1 ring-1 ring-border" role="group" aria-label="Tamanho da playlist">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={n === s}
                  onClick={() => setN(s)}
                  className={cn("h-8 rounded-pill px-3 text-small tabular transition-colors duration-(--duration-fast)", n === s ? "bg-surface-3 text-text-1" : "text-text-2 hover:text-text-1")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Celular e tablet: o painel abre acima da lista */}
          <div className="mb-4 lg:hidden">
            <Button variant="ai" className="w-full justify-between" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen}>
              Rádio dirigível: ajustar a playlist
              <ChevronDown aria-hidden="true" className={cn("transition-transform duration-(--duration-base)", panelOpen && "rotate-180")} />
            </Button>
            {panelOpen && <div className="mt-3">{panel}</div>}
          </div>

          {items.length ? (
            <div className={cn("transition-opacity duration-(--duration-base)", list.loading && "opacity-70")}>
              <TrackList
                items={items}
                seed={seed}
                playingId={current?.track_id}
                paused={paused}
                onPlay={(song, i) => playFrom(items, i, origin)}
                onRadio={openSong}
                onArtist={openArtist}
              />
            </div>
          ) : (
            <ListSkeleton />
          )}
        </section>

        <div className="sticky top-6 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain rounded-lg lg:block">{panel}</div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 8 }) {
  return (
    <div className="grid gap-2" aria-label="O modelo está analisando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-2">
          <Skeleton scan className="size-12 rounded-sm" />
          <div className="grid flex-1 gap-2">
            <Skeleton scan className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-3 w-16 md:block" />
        </div>
      ))}
      <p className="sr-only">O modelo está analisando as músicas…</p>
    </div>
  );
}
