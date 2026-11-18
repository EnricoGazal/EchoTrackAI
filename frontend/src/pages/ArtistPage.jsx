import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { getArtist } from "../api";
import { useApp } from "../features/shell/context";
import { Button } from "../ui/button";
import { Cover } from "../ui/cover";
import { Notice, SectionHeader } from "../ui/section";
import { Skeleton } from "../ui/skeleton";
import { AiMark } from "../features/ai/AiLayer";
import { TrackList } from "../features/tracks/TrackList";
import { TrackTile } from "../features/tracks/TrackTile";
import { PlaylistHero, Dot } from "../features/radio/PlaylistHero";
import { numberBR } from "../utils";
import { ListSkeleton } from "./SongPage";

const FIRST_PAGE = 10;

/** Artista: todas as músicas do catálogo e artistas de som parecido. */
export function ArtistPage() {
  const { route, playFrom, current, paused, openArtist, openSong } = useApp();
  const name = route.artist;
  const [state, setState] = useState({ data: null, error: null });
  const [all, setAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: null });
    setAll(false);
    getArtist(name, { signal: controller.signal })
      .then((data) => setState({ data, error: null }))
      .catch((err) => err.name !== "AbortError" && setState({ data: null, error: err }));
    return () => controller.abort();
  }, [name]);

  if (state.error)
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <Notice tone="danger" title="Artista não encontrado">{state.error.message}</Notice>
      </div>
    );

  const data = state.data;
  const songs = data?.songs ?? [];
  const origin = { kind: "manual", name };
  const playing = current && songs.some((s) => s.track_id === current.track_id) && !paused;

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-7xl gap-12 px-4 py-8 sm:px-8 sm:py-12">
      <PlaylistHero
        art={data ? <Cover song={{ track_id: data.artist.image_track_id }} className="w-full rounded-pill shadow-3" alt={`Foto de ${name}`} /> : <Skeleton className="aspect-square w-full rounded-pill" />}
        kicker={<span className="text-caption uppercase text-text-2">Artista</span>}
        title={name}
        meta={
          data && (
            <>
              <span>
                {numberBR(data.artist.n_songs)} {data.artist.n_songs === 1 ? "música" : "músicas"} no EchoTrack
              </span>
              {data.genres.map((g) => (
                <span key={g} className="contents">
                  <Dot />
                  <span>{g}</span>
                </span>
              ))}
            </>
          )
        }
        actions={
          <Button variant="primary" size="lg" disabled={!songs.length} onClick={() => playFrom(songs, 0, origin)}>
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
            {playing ? "Pausar" : "Tocar"}
          </Button>
        }
      />

      <section className="grid gap-4">
        <SectionHeader title="Músicas" subtitle="Da mais para a menos popular. O ícone de ondas cria um rádio a partir da música." />
        {data ? (
          <>
            <TrackList
              items={all ? songs : songs.slice(0, FIRST_PAGE)}
              ai={false}
              playingId={current?.track_id}
              paused={paused}
              onPlay={(song, i) => playFrom(songs, i, origin)}
              onRadio={openSong}
              onArtist={openArtist}
            />
            {songs.length > FIRST_PAGE && (
              <Button variant="ghost" className="w-fit" onClick={() => setAll((a) => !a)}>
                {all ? "Mostrar menos" : `Mostrar todas as ${songs.length} músicas`}
              </Button>
            )}
          </>
        ) : (
          <ListSkeleton rows={6} />
        )}
      </section>

      {data?.related?.length > 0 && (
        <section className="grid gap-6">
          <SectionHeader
            mark={<AiMark>Calculado pelo EchoTrack AI</AiMark>}
            title="Som parecido"
            subtitle={`Artistas cujo som médio é o mais próximo do de ${name}. Não usa dados de quem ouve, só o áudio.`}
          />
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {data.related.map((a) => (
              <li key={a.name}>
                <TrackTile
                  round
                  song={{ track_id: a.image_track_id, track_name: a.name }}
                  subtitle="Artista"
                  onOpen={() => openArtist(a.name)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
