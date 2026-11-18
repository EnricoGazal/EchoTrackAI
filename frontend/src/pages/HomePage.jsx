import { useEffect, useState } from "react";
import { Compass, GitCompareArrows, Pause, Play, SlidersHorizontal, Telescope } from "lucide-react";
import { getForYou, getPopular } from "../api";
import { getLibrary } from "../lib/library";
import { useApp } from "../features/shell/context";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { SectionHeader } from "../ui/section";
import { AiMark } from "../features/ai/AiLayer";
import { TrackTile } from "../features/tracks/TrackTile";
import { HeroSearch } from "../features/shell/CommandSearch";
import { numberBR } from "../utils";
import { cn } from "../lib/utils";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomePage() {
  const { user, health, playFrom, current, paused, openSong, openArtist, openGenre, navigate } = useApp();
  const [forYou, setForYou] = useState(null);
  const [popular, setPopular] = useState(null);
  const [more, setMore] = useState(false);
  const recent = getLibrary().tracks.slice(0, 6);

  useEffect(() => {
    getForYou(12).then((d) => setForYou(d.recommendations)).catch(() => setForYou([]));
    getPopular(12).then((d) => setPopular(d.results)).catch(() => setPopular([]));
  }, []);

  const firstName = user?.name?.split(" ")[0];
  const profileTitle = user?.profile?.title;
  const forYouOrigin = { kind: "profile", title: profileTitle };
  const forYouPlaying = forYou && current && forYou.some((s) => s.track_id === current.track_id) && !paused;
  const starter = forYou?.[0] || popular?.[0];
  const isPlaying = (s) => current?.track_id === s.track_id;

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-7xl gap-16 px-4 py-8 sm:px-8 sm:py-12">
      {/* Abertura: em poucos segundos, o que é e de onde vêm as recomendações */}
      <section className="grid gap-6">
        <p className="text-small text-text-2">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </p>
        <h1 className="font-display-tight text-hero-m font-heavy text-balance">
          Música escolhida pelo som.
          <span className="block text-text-3">Não pela audiência.</span>
        </h1>
        <p className="max-w-[58ch] text-body text-text-2">
          O <span className="text-text-1">EchoTrack AI</span> compara 128 características de áudio de{" "}
          {health.n_songs ? numberBR(health.n_songs) : "quase 90 mil"} músicas, mostra de onde veio cada recomendação
          e deixa você conduzir o resultado.
        </p>
        <div className="flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
          <HeroSearch onSong={openSong} onArtist={openArtist} onGenre={openGenre} className="flex-1" />
          <Button size="lg" className="h-16 shrink-0 px-6" onClick={() => navigate({ name: "discover" })}>
            <GitCompareArrows aria-hidden="true" /> Criar uma ponte
          </Button>
        </div>
      </section>

      {/* Feito para você: tudo aqui veio do modelo */}
      <section className="grid gap-6">
        <SectionHeader
          mark={<AiMark>Recomendado pelo EchoTrack AI</AiMark>}
          title="Feito para você"
          subtitle={
            <>
              Do seu perfil <span className="text-text-1">{profileTitle || "musical"}</span>. Cada música diz de qual gosto seu ela veio.
            </>
          }
          action={
            forYou?.length > 0 && (
              <Button variant="primary" size="icon" aria-label={forYouPlaying ? "Pausar Feito para você" : "Tocar Feito para você"} onClick={() => playFrom(forYou, Math.max(0, forYou.findIndex(isPlaying)), forYouOrigin)}>
                {forYouPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="translate-x-px" />}
              </Button>
            )
          }
        />
        {forYou === null ? (
          <TileSkeletons scan />
        ) : forYou.length ? (
          <>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
              {(more ? forYou : forYou.slice(0, 6)).map((s, i) => (
                <li key={s.track_id}>
                  <TrackTile
                    song={s}
                    because={s.because}
                    playing={isPlaying(s)}
                    paused={paused}
                    onPlay={() => playFrom(forYou, i, forYouOrigin)}
                    onOpen={openSong}
                  />
                </li>
              ))}
            </ul>
            {forYou.length > 6 && (
              <Button variant="ghost" className="w-fit" onClick={() => setMore((m) => !m)}>
                {more ? "Mostrar menos" : `Mostrar mais ${forYou.length - 6}`}
              </Button>
            )}
          </>
        ) : (
          <p className="text-small text-text-2">Responda o questionário para a IA montar a sua seleção.</p>
        )}
      </section>

      {/* Os três diferenciais */}
      <section className="grid gap-6">
        <SectionHeader title="Três jeitos de conduzir a IA" subtitle="Coisas que um app de música comum não deixa você fazer." />
        <ul className="grid gap-4 md:grid-cols-3">
          <Feature
            icon={SlidersHorizontal}
            title="Rádio dirigível"
            text="Puxe a playlist para mais energia, mais acústica ou mais alegria, e veja a lista se refazer na hora."
            cta={starter ? "Testar agora" : null}
            onClick={() => starter && openSong(starter)}
          />
          <Feature
            icon={Compass}
            title="Ponte entre duas músicas"
            text="Escolha de onde sair e onde chegar. O modelo monta uma playlist que vai mudando aos poucos de uma para a outra."
            cta="Montar uma ponte"
            onClick={() => navigate({ name: "discover" })}
          />
          <Feature
            icon={Telescope}
            title="Fora da bolha"
            text="Mesmo som, artistas menos conhecidos. O contrário de recomendar só o que já está em alta."
            cta={starter ? "Ver fora da bolha" : null}
            onClick={() => starter && navigate({ name: "song", id: starter.track_id }, { hint: { song: starter, obscure: true } })}
          />
        </ul>
      </section>

      {recent.length > 0 && (
        <section className="grid gap-6">
          <SectionHeader title="Ouvidas recentemente" />
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {recent.map((s, i) => (
              <li key={s.track_id}>
                <TrackTile song={s} playing={isPlaying(s)} paused={paused} onPlay={() => playFrom(recent, i, { kind: "manual", name: "Ouvidas recentemente" })} onOpen={openSong} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Conteúdo que NÃO vem do modelo fica neutro */}
      <section className="grid gap-6">
        <SectionHeader
          mark={<Badge variant="outline">Não é recomendação · ordenado por popularidade</Badge>}
          title="Mais tocadas no catálogo"
          subtitle="Um bom ponto de partida: escolha uma e o modelo monta o rádio dela."
        />
        {popular === null ? (
          <TileSkeletons />
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {popular.slice(0, 12).map((s, i) => (
              <li key={s.track_id}>
                <TrackTile song={s} playing={isPlaying(s)} paused={paused} onPlay={() => playFrom(popular, i, { kind: "manual", name: "Mais tocadas" })} onOpen={openSong} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Feature({ icon: Icon, title, text, cta, onClick }) {
  return (
    <li className="flex flex-col gap-4 rounded-lg bg-surface-1 p-5 shadow-1 ring-1 ring-border/70">
      <span className="grid size-10 place-items-center rounded-md bg-surface-2">
        <Icon aria-hidden="true" className="size-5 text-ai" />
      </span>
      <div className="grid gap-1.5">
        <h3 className="font-display-wide text-heading font-semibold">{title}</h3>
        <p className="text-small text-text-2">{text}</p>
      </div>
      {cta && (
        <Button variant="ai" size="sm" className="mt-auto w-fit" onClick={onClick}>
          {cta}
        </Button>
      )}
    </li>
  );
}

export function TileSkeletons({ count = 6, scan = false, className }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6", className)} aria-label={scan ? "O modelo está analisando" : "Carregando"}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-3">
          <Skeleton scan={scan} className="aspect-square w-full rounded-md" />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
