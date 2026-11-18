import { useEffect, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { recommendFromGenre } from "../api";
import { rememberPlaylist } from "../lib/library";
import { useApp } from "../features/shell/context";
import { Button } from "../ui/button";
import { Cover } from "../ui/cover";
import { Notice } from "../ui/section";
import { AiMark } from "../features/ai/AiLayer";
import { TrackList } from "../features/tracks/TrackList";
import { PlaylistHero, Dot } from "../features/radio/PlaylistHero";
import { DEFAULT_LAMBDA, SteerPanel, lambdaFromVariety, varietyFromLambda } from "../features/radio/SteerPanel";
import { statusText, useSteeredList } from "../features/radio/useSteeredList";
import { numberBR } from "../utils";
import { ListSkeleton } from "./SongPage";
import { cn } from "../lib/utils";

const INITIAL = { steer: {}, variety: varietyFromLambda(DEFAULT_LAMBDA), obscure: false };

/** Playlist a partir do som médio de um gênero. */
export function GenrePage() {
  const { route, hint, playFrom, current, paused, openArtist, openSong } = useApp();
  const id = route.id;
  const [controls, setControls] = useState(INITIAL);
  useEffect(() => setControls(INITIAL), [id]);

  const opts = useMemo(() => ({ n: 20, lam: lambdaFromVariety(controls.variety), obscure: controls.obscure }), [controls]);
  const list = useSteeredList((o) => recommendFromGenre(id, opts, o), JSON.stringify([id, opts]));
  useEffect(() => list.resetDiff(), [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = list.data?.profile?.genre === id ? list.data : null;
  const label = data?.profile.label ?? hint?.label ?? "…";
  const items = data?.recommendations ?? [];
  const origin = data ? { kind: "genre", profile: data.profile, label } : null;
  const seed = data ? { ...data.profile, track_name: label } : null;
  const playing = current && items.some((s) => s.track_id === current.track_id) && !paused;

  useEffect(() => {
    if (data) rememberPlaylist({ kind: "genre", id, title: label, subtitle: "Gênero", cover: data.recommendations[0]?.track_id });
  }, [data, id, label]);

  if (list.error && !data)
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <Notice tone="danger" title="Não foi possível montar esta playlist">{list.error.message}</Notice>
      </div>
    );

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-7xl gap-10 px-4 py-8 sm:px-8 sm:py-12">
      <PlaylistHero
        art={
          <div className="grid aspect-square grid-cols-2 overflow-hidden rounded-md shadow-3">
            {(items.length >= 4 ? items.slice(0, 4) : [null, null, null, null]).map((s, i) =>
              s ? <Cover key={s.track_id} song={s} className="rounded-none shadow-none" /> : <span key={i} className="bg-surface-2" />
            )}
          </div>
        }
        kicker={<AiMark>Playlist pelo som médio do gênero</AiMark>}
        title={label}
        meta={
          data && (
            <>
              <span>Som médio de {numberBR(data.profile.n_songs)} músicas</span>
              {data.profile.subgenres?.length > 1 && (<><Dot /><span>{data.profile.subgenres.length} estilos</span></>)}
              <Dot />
              <span className="tabular">{Math.round(data.profile.tempo)} BPM médio</span>
            </>
          )
        }
        actions={
          <Button variant="primary" size="lg" disabled={!items.length} onClick={() => playFrom(items, 0, origin)}>
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
            {playing ? "Pausar" : "Tocar a playlist"}
          </Button>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section aria-busy={list.loading} className="min-w-0">
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
        <SteerPanel
          className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto"
          features={false}
          value={controls}
          onChange={setControls}
          onReset={() => setControls(INITIAL)}
          status={{ loading: list.loading, text: statusText(list) }}
        />
      </div>
    </div>
  );
}
