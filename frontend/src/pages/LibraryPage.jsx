import { useState } from "react";
import { Compass, Disc3, Shapes, Trash2 } from "lucide-react";
import { clearLibrary, getLibrary } from "../lib/library";
import { useApp } from "../features/shell/context";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Cover } from "../ui/cover";
import { SectionHeader } from "../ui/section";
import { TrackList } from "../features/tracks/TrackList";

const KIND = {
  song: { label: "Rádio", icon: Disc3 },
  genre: { label: "Gênero", icon: Shapes },
  bridge: { label: "Ponte", icon: Compass },
};

/** O que a pessoa ouviu e as playlists que gerou (guardado só neste navegador). */
export function LibraryPage() {
  const { navigate, playFrom, current, paused, openArtist, openSong } = useApp();
  const [lib, setLib] = useState(getLibrary);

  const open = (p) => {
    if (p.kind === "song") navigate({ name: "song", id: p.id });
    else if (p.kind === "genre") navigate({ name: "genre", id: p.id }, { hint: { label: p.title } });
    else navigate({ name: "discover", from: p.from, to: p.to });
  };

  const empty = !lib.tracks.length && !lib.playlists.length;

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-6xl gap-12 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display-tight text-display font-heavy">Biblioteca</h1>
          <p className="text-small text-text-2">Suas playlists geradas e o que você ouviu. Fica guardado só neste navegador.</p>
        </div>
        {!empty && (
          <Button variant="ghost" onClick={() => { clearLibrary(); setLib(getLibrary()); }}>
            <Trash2 aria-hidden="true" /> Limpar
          </Button>
        )}
      </header>

      {empty && (
        <div className="grid justify-items-start gap-4 rounded-lg bg-surface-1 p-8 shadow-1 ring-1 ring-border/70">
          <Disc3 aria-hidden="true" className="size-8 text-text-3" />
          <p className="font-display-wide text-heading font-semibold">Nada por aqui ainda</p>
          <p className="max-w-[50ch] text-small text-text-2">Gere uma playlist ou toque uma música e ela aparece aqui.</p>
          <Button variant="primary" onClick={() => navigate({ name: "home" })}>Ir para o início</Button>
        </div>
      )}

      {lib.playlists.length > 0 && (
        <section className="grid gap-4">
          <SectionHeader title="Playlists que você gerou" />
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lib.playlists.map((p) => {
              const K = KIND[p.kind] || KIND.song;
              return (
                <li key={p.key}>
                  <button type="button" onClick={() => open(p)} className="flex w-full items-center gap-4 rounded-md bg-surface-1 p-3 text-left shadow-1 ring-1 ring-border/70 transition-colors duration-(--duration-fast) hover:bg-surface-2">
                    {p.cover ? <Cover song={{ track_id: p.cover }} className="size-14 shrink-0 rounded-sm" /> : <span className="size-14 rounded-sm bg-surface-3" />}
                    <span className="min-w-0">
                      <Badge variant="outline" className="mb-1">
                        <K.icon aria-hidden="true" /> {K.label}
                      </Badge>
                      <span className="block truncate text-small font-semibold text-text-1">{p.title}</span>
                      <span className="block truncate text-caption text-text-2 tracking-normal">{p.subtitle}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {lib.tracks.length > 0 && (
        <section className="grid gap-4">
          <SectionHeader title="Ouvidas recentemente" />
          <TrackList
            items={lib.tracks}
            ai={false}
            playingId={current?.track_id}
            paused={paused}
            onPlay={(s, i) => playFrom(lib.tracks, i, { kind: "manual", name: "Ouvidas recentemente" })}
            onRadio={openSong}
            onArtist={openArtist}
          />
        </section>
      )}
    </div>
  );
}
