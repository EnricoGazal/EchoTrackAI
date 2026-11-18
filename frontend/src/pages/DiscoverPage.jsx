import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownUp, Pause, Play, Plus, Shapes } from "lucide-react";
import { getBridge, getGenres, getRadio, searchSongs } from "../api";
import { rememberPlaylist } from "../lib/library";
import { useApp } from "../features/shell/context";
import { Button, IconButton } from "../ui/button";
import { Cover } from "../ui/cover";
import { Switch } from "../ui/switch";
import { ScanLine, Skeleton } from "../ui/skeleton";
import { Notice, SectionHeader } from "../ui/section";
import { AiMark } from "../features/ai/AiLayer";
import { BridgeShare } from "../features/now-playing/NowPlaying";
import { Equalizer } from "../features/tracks/Equalizer";
import { cleanTitle, formatArtists } from "../utils";
import { cn } from "../lib/utils";

const STOPS = [8, 12, 16];

/** Descobrir: a Ponte entre duas músicas e a exploração por gênero. */
export function DiscoverPage() {
  const { route, navigate, pickSong, playFrom, current, paused, openGenre } = useApp();
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [n, setN] = useState(12);
  const [obscure, setObscure] = useState(false);
  const [bridge, setBridge] = useState({ data: null, loading: false, error: null, ms: null });
  const [genres, setGenres] = useState([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    getGenres().then((d) => setGenres(d.details)).catch(() => {});
  }, []);

  // Músicas vindas do endereço (ex.: "Criar ponte a partir desta").
  useEffect(() => {
    if (route.from && route.from !== from?.track_id) getRadio(route.from).then((d) => setFrom(d.seed)).catch(() => {});
    if (route.to && route.to !== to?.track_id) getRadio(route.to).then((d) => setTo(d.seed)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.from, route.to]);

  const sync = (a, b) => navigate({ name: "discover", from: a?.track_id, to: b?.track_id }, { replace: true });
  const chooseFrom = () => pickSong("Música de partida", (s) => { setFrom(s); sync(s, to); });
  const chooseTo = () => pickSong("Música de chegada", (s) => { setTo(s); sync(from, s); });
  const swap = () => { setFrom(to); setTo(from); sync(to, from); };

  // A ponte é calculada assim que as duas pontas existem.
  useEffect(() => {
    if (!from || !to || from.track_id === to.track_id) return undefined;
    const controller = new AbortController();
    const started = performance.now();
    setBridge((b) => ({ ...b, loading: true, error: null }));
    getBridge(from.track_id, to.track_id, { n, obscure }, { signal: controller.signal })
      .then((data) => {
        setBridge({ data, loading: false, error: null, ms: Math.round(performance.now() - started) });
        rememberPlaylist({
          kind: "bridge",
          id: `${from.track_id}>${to.track_id}`,
          title: `${cleanTitle(from.track_name)} → ${cleanTitle(to.track_name)}`,
          subtitle: "Ponte",
          cover: from.track_id,
          from: from.track_id,
          to: to.track_id,
        });
      })
      .catch((err) => err.name !== "AbortError" && setBridge((b) => ({ ...b, loading: false, error: err })));
    return () => controller.abort();
  }, [from, to, n, obscure]);

  const data = bridge.data && from && to && bridge.data.start.track_id === from.track_id && bridge.data.end.track_id === to.track_id ? bridge.data : null;
  const path = data ? [data.start, ...data.steps, data.end] : [];
  const origin = data ? { kind: "bridge", from: data.start, to: data.end } : null;
  const pathPlaying = current && path.some((s) => s.track_id === current.track_id) && !paused;

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-6xl gap-14 px-4 py-8 sm:px-8 sm:py-12">
      <header className="grid gap-3">
        <AiMark className="w-fit">Recurso exclusivo do EchoTrack</AiMark>
        <h1 className="font-display-tight text-display font-heavy text-balance">Ponte entre duas músicas</h1>
        <p className="max-w-[60ch] text-body text-text-2">
          Escolha de onde sair e onde chegar. O modelo traça uma linha reta entre o som das duas e escolhe,
          em cada parada, a música mais próxima. A playlist muda aos poucos de uma para a outra.
        </p>
      </header>

      <section aria-label="Montar a ponte" className="grid gap-4 rounded-lg bg-surface-1 p-4 shadow-1 ring-1 ring-border/70 sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <EndSlot label="Sai de" song={from} onChoose={chooseFrom} tone="from" />
          <IconButton label="Inverter as pontas" onClick={swap} disabled={!from && !to} className="justify-self-center lg:rotate-90">
            <ArrowDownUp />
          </IconButton>
          <EndSlot label="Chega em" song={to} onChoose={chooseTo} tone="to" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-4">
          <div className="flex items-center gap-3">
            <span className="text-small text-text-2">Paradas</span>
            <div className="flex items-center gap-1 rounded-pill bg-surface-2 p-1" role="group" aria-label="Número de músicas">
              {STOPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={n === s}
                  onClick={() => setN(s)}
                  className={cn("h-8 rounded-pill px-3 text-small tabular", n === s ? "bg-surface-3 text-text-1" : "text-text-2 hover:text-text-1")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 text-small text-text-1">
            <Switch checked={obscure} onCheckedChange={setObscure} aria-label="Fora da bolha" />
            Fora da bolha
          </label>
        </div>
      </section>

      {from && to && from.track_id === to.track_id && (
        <Notice title="Escolha duas músicas diferentes">A ponte precisa de uma música de partida e outra de chegada.</Notice>
      )}
      {bridge.error && <Notice tone="danger" title="Não foi possível montar a ponte">{bridge.error.message}</Notice>}

      {from && to && from.track_id !== to.track_id && (
        <section aria-labelledby="caminho" aria-busy={bridge.loading} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="caminho" className="font-display-wide text-title font-semibold">O caminho</h2>
              <p className="mt-1 text-small text-text-2" aria-live="polite">
                {bridge.loading
                  ? "O modelo está traçando a ponte…"
                  : data
                  ? `${path.length} músicas · calculada em ${bridge.ms} ms. A barra mostra quanto cada uma lembra a de partida (branco) e a de chegada (ciano).`
                  : ""}
              </p>
            </div>
            <Button variant="primary" size="lg" disabled={!data} onClick={() => playFrom(path, 0, origin)}>
              {pathPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
              {pathPlaying ? "Pausar" : "Tocar a ponte"}
            </Button>
          </div>
          <ScanLine active={bridge.loading} />

          {data ? (
            <ol className="relative grid grid-cols-[minmax(0,1fr)] gap-1">
              <span
                aria-hidden="true"
                className="absolute top-7 bottom-7 left-[1.375rem] w-0.5 rounded-pill bg-[linear-gradient(to_bottom,var(--text-1),var(--ai))] opacity-60 sm:left-[1.625rem]"
              />
              {path.map((s, i) => {
                const end = i === 0 || i === path.length - 1;
                const isCurrent = current?.track_id === s.track_id;
                return (
                  <motion.li
                    key={s.track_id}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: reduce ? 0 : i * 0.035, ease: [0.22, 1, 0.36, 1] }}
                    className={cn("relative flex items-center gap-4 rounded-md p-2 transition-colors duration-(--duration-fast) hover:bg-surface-1", isCurrent && "bg-surface-1")}
                  >
                    <button
                      type="button"
                      onClick={() => playFrom(path, i, origin)}
                      aria-label={`Tocar ${cleanTitle(s.track_name)}`}
                      className={cn("relative z-10 shrink-0 rounded-sm", end && "ring-2 ring-offset-2 ring-offset-bg", i === 0 && "ring-text-1", i === path.length - 1 && "ring-ai")}
                    >
                      <Cover song={s} className={cn("rounded-sm", end ? "size-11 sm:size-13" : "size-11")} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2">
                        {isCurrent && <Equalizer playing={!paused} />}
                        <span className={cn("truncate text-body font-medium", isCurrent ? "text-brand" : "text-text-1")}>{cleanTitle(s.track_name)}</span>
                      </p>
                      <p className="truncate text-small text-text-2">
                        {formatArtists(s.artists)} · {s.genre_group}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {i === 0 ? (
                        <span className="text-caption text-text-1 tracking-normal">Partida</span>
                      ) : i === path.length - 1 ? (
                        <span className="text-caption text-ai tracking-normal">Chegada</span>
                      ) : (
                        <BridgeShare song={s} size="sm" />
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          ) : (
            <div className="grid gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 p-2">
                  <Skeleton scan className="size-11 rounded-sm" />
                  <Skeleton scan className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {(!from || !to) && <BridgeExamples onPick={(a, b) => { setFrom(a); setTo(b); sync(a, b); }} />}

      <section className="grid gap-6">
        <SectionHeader
          title="Explorar por gênero"
          subtitle="Cada gênero vira uma playlist a partir do som médio das músicas dele."
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {genres.map((g) => (
            <li key={g.genre}>
              <button
                type="button"
                onClick={() => openGenre(g)}
                title={`Inclui: ${g.subgenres.join(", ")}`}
                className="flex h-20 w-full items-center gap-3 rounded-md bg-surface-1 px-4 text-left shadow-1 ring-1 ring-border/70 transition-colors duration-(--duration-fast) hover:bg-surface-2"
              >
                <Shapes aria-hidden="true" className="size-5 shrink-0 text-text-3" />
                <span className="min-w-0">
                  <span className="block truncate text-small font-semibold text-text-1">{g.label}</span>
                  <span className="block text-caption text-text-2 tracking-normal">{g.n_songs.toLocaleString("pt-BR")} músicas</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EndSlot({ label, song, onChoose, tone }) {
  return (
    <button
      type="button"
      onClick={onChoose}
      className={cn(
        "flex min-h-20 w-full items-center gap-4 rounded-md p-3 text-left ring-1 transition-colors duration-(--duration-fast)",
        song ? "bg-surface-2 ring-border hover:bg-surface-3" : "border border-dashed border-border-strong ring-transparent hover:bg-surface-2"
      )}
    >
      {song ? (
        <Cover song={song} className={cn("size-14 shrink-0 rounded-sm ring-2 ring-offset-2 ring-offset-surface-2", tone === "from" ? "ring-text-1" : "ring-ai")} />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-sm bg-surface-3 text-text-2">
          <Plus aria-hidden="true" className="size-5" />
        </span>
      )}
      <span className="min-w-0">
        <span className={cn("block text-caption tracking-normal", tone === "from" ? "text-text-2" : "text-ai")}>{label}</span>
        <span className="block truncate text-body font-semibold text-text-1">{song ? cleanTitle(song.track_name) : "Escolher música"}</span>
        {song && <span className="block truncate text-small text-text-2">{formatArtists(song.artists)}</span>}
      </span>
    </button>
  );
}

// Pontes prontas para testar com um clique.
const EXAMPLES = [
  ["watermelon sugar", "harry styles", "bohemian rhapsody", "queen"],
  ["garota de ipanema", "", "blinding lights", "the weeknd"],
  ["clair de lune", "", "lose yourself", "eminem"],
];

function BridgeExamples({ onPick }) {
  const [busy, setBusy] = useState(null);
  async function load(i) {
    const [qa, aa, qb, ab] = EXAMPLES[i];
    setBusy(i);
    try {
      const pick = async (q, artist) => {
        const d = await searchSongs(q, 8);
        return d.results.find((s) => !artist || s.artists.toLowerCase().includes(artist)) || d.results[0];
      };
      const [a, b] = await Promise.all([pick(qa, aa), pick(qb, ab)]);
      if (a && b) onPick(a, b);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="grid gap-3">
      <h2 className="text-small font-semibold text-text-2">Ou experimente uma destas</h2>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((e, i) => (
          <Button key={i} variant="outline" size="sm" disabled={busy != null} onClick={() => load(i)} className="h-auto min-h-8 py-1.5 text-left whitespace-normal">
            {busy === i ? "Buscando…" : `${titleCase(e[0])} → ${titleCase(e[2])}`}
          </Button>
        ))}
      </div>
    </section>
  );
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
