import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Search } from "lucide-react";
import { getGenres, getOnboardingArtists, getOnboardingOptions, getRelatedArtists, searchSongs, sendOnboarding } from "../api";
import { Button } from "../ui/button";
import { Cover } from "../ui/cover";
import { Input } from "../ui/input";
import { Logo } from "../ui/logo";
import { Notice } from "../ui/section";
import { Skeleton } from "../ui/skeleton";
import { cleanTitle, formatArtists } from "../utils";
import { cn } from "../lib/utils";

// Cada pergunta tem uma palavra em destaque: é o que a IA está tentando aprender.
const STEPS = [
  { id: "genres", title: ["Quais ", "gêneros", " você curte?"], hint: "Escolha quantos quiser." },
  { id: "artists", title: ["Escolha 3 ou mais ", "artistas", " que você curte."], hint: "Ao escolher um, aparecem outros parecidos com ele. Eles viram pontos de partida para a IA entender o seu som." },
  { id: "era", title: ["O que tocava quando você tinha ", "uns 15 anos", "?"], hint: "Marque as que lembram a sua adolescência. Com elas, a IA arrisca um palpite da sua idade. Se nenhuma, é só continuar." },
  { id: "songs", title: ["Quais ", "músicas", " você não para de ouvir?"], hint: "Busque e escolha quantas quiser. Se preferir, é só continuar." },
];

/** Questionário inicial: uma pergunta por tela. */
export function Onboarding({ name, onDone }) {
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState([]);
  const [artists, setArtists] = useState(null);
  const [eraSongs, setEraSongs] = useState(null); // músicas de cada época, para o palpite de idade
  const [answers, setAnswers] = useState({ genres: [], artists: [], era_songs: [], songs: [] });
  const [pickedArtists, setPickedArtists] = useState([]); // artistas escolhidos (para mostrar mesmo fora da lista)
  const [pickedSongs, setPickedSongs] = useState([]); // músicas escolhidas
  const [query, setQuery] = useState("");
  const found = useSearch(STEPS[step].id === "artists" || STEPS[step].id === "songs" ? query : "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    getGenres().then((d) => setGenres(d.details)).catch(() => {});
    getOnboardingOptions().then((d) => setEraSongs(d.era_songs)).catch(() => setEraSongs([]));
  }, []);

  // Lista de artistas: só recarrega quando os gêneros mudam, para não perder
  // os artistas que entraram como "parecidos". Os já escolhidos ficam no topo.
  const artistsFor = useRef(null);
  useEffect(() => {
    if (STEPS[step].id !== "artists") return undefined;
    const key = answers.genres.join(",");
    if (artistsFor.current === key) return undefined;
    const controller = new AbortController();
    setArtists(null);
    getOnboardingArtists(answers.genres, { signal: controller.signal })
      .then((d) => {
        artistsFor.current = key;
        setArtists([...pickedArtists, ...d.artists.filter((a) => !pickedArtists.some((p) => p.name === a.name))]);
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, answers.genres]);

  const toggle = (field, value) =>
    setAnswers((a) => ({ ...a, [field]: a[field].includes(value) ? a[field].filter((v) => v !== value) : [...a[field], value] }));

  const pickArtist = (a) => {
    toggle("artists", a.name);
    setPickedArtists((list) => (list.some((x) => x.name === a.name) ? list.filter((x) => x.name !== a.name) : [...list, a]));
    if (answers.artists.includes(a.name)) return; // desmarcou

    // Como no Spotify: o artista escolhido entra na lista (se veio da busca)
    // e logo depois dele aparecem três artistas parecidos.
    if (searching) setQuery("");
    setArtists((list) => (list?.some((x) => x.name === a.name) ? list : [a, ...(list ?? [])]));
    // Os parecidos que já estavam na lista mudam de lugar e vêm para perto dele.
    getRelatedArtists(a.name, answers.artists)
      .then((d) =>
        setArtists((list) => {
          if (!list || !list.some((x) => x.name === a.name)) return list;
          const near = d.artists.map((x) => list.find((y) => y.name === x.name) ?? x);
          const rest = list.filter((x) => !near.some((y) => y.name === x.name));
          const at = rest.findIndex((x) => x.name === a.name);
          return [...rest.slice(0, at + 1), ...near, ...rest.slice(at + 1)];
        })
      )
      .catch(() => {});
  };
  const pickSong = (song) => {
    toggle("songs", song.track_id);
    setPickedSongs((list) =>
      list.some((x) => x.track_id === song.track_id) ? list.filter((x) => x.track_id !== song.track_id) : [...list, song]
    );
  };
  const goStep = (i) => {
    setStep(i);
    setQuery("");
    window.scrollTo({ top: 0 });
  };

  const current = STEPS[step];
  const searching = query.trim() !== "";
  const canGo =
    (current.id === "genres" && answers.genres.length > 0) ||
    (current.id === "artists" && answers.artists.length >= 3) ||
    current.id === "era" ||
    current.id === "songs";

  async function next() {
    if (step < STEPS.length - 1) {
      goStep(step + 1);
      return;
    }
    setSending(true);
    setError(null);
    try {
      onDone(await sendOnboarding(answers));
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-(--glass-ring) bg-(--glass-bg) backdrop-blur-(--glass-blur)">
        <div className="mx-auto flex h-18 max-w-5xl items-center gap-6 px-6 sm:px-10">
          <Logo withName={false} />
          <div
            className="grid flex-1 gap-1.5"
            style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}
            role="progressbar"
            aria-label="Progresso do questionário"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
          >
            {STEPS.map((s, i) => (
              <span key={s.id} className={cn("h-1 rounded-pill transition-colors duration-(--duration-slow)", i <= step ? "bg-text-1" : "bg-surface-3")} />
            ))}
          </div>
          <span className="text-small tabular text-text-2">
            Passo {step + 1} de {STEPS.length}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:px-10 sm:py-20">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-12"
          >
            <div className="mx-auto grid max-w-3xl gap-4 text-center">
              <p className="text-small text-text-2">{step === 0 ? `Olá, ${name}. Vamos conhecer o seu gosto.` : current.hint}</p>
              <h1 className="font-display-tight text-display font-heavy text-balance text-text-1">
                {current.title[0]}
                <span className="text-brand">{current.title[1]}</span>
                {current.title[2]}
              </h1>
              {step === 0 && <p className="text-body text-text-2">{current.hint}</p>}
            </div>

            {current.id === "genres" && (
              <div className="grid gap-8">
                <SearchBox value={query} onChange={setQuery} placeholder="Busque um gênero (funk, rock, pagode…)" />
                {(() => {
                  const shown = genres.filter((g) => answers.genres.includes(g.genre) || matchesGenre(g, query));
                  if (genres.length && !shown.length)
                    return <p className="text-center text-body text-text-2">Nenhum gênero encontrado para “{query.trim()}”.</p>;
                  return (
                    <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2.5">
                      {genres.length
                        ? shown.map((g) => (
                            <Chip key={g.genre} on={answers.genres.includes(g.genre)} onClick={() => toggle("genres", g.genre)}>
                              {g.label}
                            </Chip>
                          ))
                        : Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-11 w-28 rounded-pill" />)}
                    </div>
                  );
                })()}
              </div>
            )}

            {current.id === "artists" && (
              <div className="grid gap-8">
                <SearchBox value={query} onChange={setQuery} placeholder="Busque um artista" />
                {searching && found && !found.artists.length ? (
                  <p className="text-center text-body text-text-2">Nenhum artista encontrado para “{query.trim()}”.</p>
                ) : (
              <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
                {((searching ? found?.artists : artists) ?? Array.from({ length: searching ? 3 : 12 }, () => null)).map((a, i) =>
                  a ? (
                    <motion.li
                      key={a.name}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    >
                      <Pick on={answers.artists.includes(a.name)} onClick={() => pickArtist(a)} round label={a.name}>
                        <Cover song={{ track_id: a.image_track_id }} className="w-full rounded-pill" />
                      </Pick>
                    </motion.li>
                  ) : (
                    <li key={i} className="grid gap-2">
                      <Skeleton className="aspect-square w-full rounded-pill" />
                      <Skeleton className="mx-auto h-3 w-2/3" />
                    </li>
                  )
                )}
              </ul>
                )}
              </div>
            )}

            {current.id === "era" && (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
                {(eraSongs ?? Array.from({ length: 12 }, () => null)).map((s, i) =>
                  s ? (
                    <li key={s.track_id}>
                      <Pick on={answers.era_songs.includes(s.track_id)} onClick={() => toggle("era_songs", s.track_id)} label={cleanTitle(s.track_name)} sub={formatArtists(s.artists)}>
                        <Cover song={s} className="w-full rounded-md" />
                      </Pick>
                    </li>
                  ) : (
                    <li key={i} className="grid gap-2">
                      <Skeleton className="aspect-square w-full rounded-md" />
                      <Skeleton className="mx-auto h-3 w-2/3" />
                    </li>
                  )
                )}
              </ul>
            )}

            {current.id === "songs" && (
              <div className="grid gap-8">
                <SearchBox value={query} onChange={setQuery} placeholder="Busque uma música ou artista" />
                {searching &&
                  (!found ? (
                    <div className="mx-auto grid w-full max-w-2xl gap-2">
                      {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-md" />
                      ))}
                    </div>
                  ) : found.results.length === 0 ? (
                    <p className="text-center text-body text-text-2">Nenhuma música encontrada para “{query.trim()}”.</p>
                  ) : (
                    <ul className="mx-auto grid w-full max-w-2xl gap-1" aria-label="Resultados da busca">
                      {found.results.map((s) => {
                        const on = answers.songs.includes(s.track_id);
                        return (
                          <li key={s.track_id}>
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => pickSong(s)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors duration-(--duration-fast)",
                                on ? "bg-surface-2" : "hover:bg-surface-2"
                              )}
                            >
                              <Cover song={s} className="size-12 shrink-0 rounded-sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-body font-semibold text-text-1">{cleanTitle(s.track_name)}</span>
                                <span className="block truncate text-small text-text-2">{formatArtists(s.artists)}</span>
                              </span>
                              <span
                                aria-hidden="true"
                                className={cn("grid size-7 shrink-0 place-items-center rounded-pill", on ? "bg-text-1 text-bg" : "ring-1 ring-border")}
                              >
                                {on && <Check className="size-4" />}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ))}
                {pickedSongs.length > 0 && (
                  <div className="grid gap-4">
                    <p className="text-center text-small text-text-2">Suas escolhas</p>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
                      {pickedSongs.map((s) => (
                        <li key={s.track_id}>
                          <Pick on onClick={() => pickSong(s)} label={cleanTitle(s.track_name)} sub={formatArtists(s.artists)}>
                            <Cover song={s} className="w-full rounded-md" />
                          </Pick>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {error && <Notice tone="danger">{error}</Notice>}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="sticky bottom-0 border-t border-(--glass-ring) bg-(--glass-bg) backdrop-blur-(--glass-blur)">
        <div className="mx-auto flex h-22 max-w-5xl items-center justify-between gap-4 px-6 sm:px-10">
          <span className="text-small text-text-2" aria-live="polite">
            {current.id === "artists" && answers.artists.length < 3
              ? `Escolha mais ${3 - answers.artists.length}`
              : current.id === "genres" && !answers.genres.length
              ? "Escolha pelo menos um"
              : ""}
          </span>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="lg" onClick={() => goStep(step - 1)}>
                Voltar
              </Button>
            )}
            <Button variant="primary" size="lg" disabled={!canGo || sending} onClick={next} className="min-w-36">
              {sending ? "A IA está ouvindo o seu gosto…" : step === STEPS.length - 1 ? "Ver meu perfil" : "Continuar"}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Sem acento e em minúsculas: "forro" acha "Forró".
const normalize = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** O gênero aparece na busca pelo nome ou por um dos subgêneros ("punk" acha Rock). */
function matchesGenre(g, query) {
  const q = normalize(query);
  if (!q) return true;
  return [g.label, ...(g.subgenres || [])].some((name) => normalize(name.replace(/-/g, " ")).includes(q.replace(/-/g, " ")));
}

/** Busca de músicas e artistas, com uma espera curta entre as teclas. null enquanto carrega. */
function useSearch(q) {
  const [data, setData] = useState({ results: [], artists: [] });
  useEffect(() => {
    const text = q.trim();
    if (!text) {
      setData({ results: [], artists: [] });
      return undefined;
    }
    setData(null);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchSongs(text, 8, { signal: controller.signal })
        .then((d) => setData({ results: d.results, artists: d.artists || [] }))
        .catch((err) => err.name !== "AbortError" && setData({ results: [], artists: [] }));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);
  return data;
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="relative mx-auto block w-full max-w-2xl">
      <span className="sr-only">{placeholder}</span>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-text-2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-13 rounded-pill bg-surface-1/70 pl-13 shadow-none ring-(--glass-ring) hover:ring-border focus-visible:bg-surface-2"
      />
    </label>
  );
}

function Chip({ on, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-pill px-6 text-body transition-[background-color,color,transform] duration-(--duration-base) ease-out active:scale-[0.97]",
        on ? "bg-text-1 text-bg" : "bg-surface-1/70 text-text-1 ring-1 ring-(--glass-ring) hover:bg-surface-2 hover:ring-border"
      )}
      {...props}
    >
      {on && <Check aria-hidden="true" className="size-4" />}
      {children}
    </button>
  );
}

function Pick({ on, onClick, round, label, sub, children }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="group grid w-full gap-2 text-center">
      <span className={cn("relative block transition-transform duration-(--duration-base) ease-out group-active:scale-[0.97]", round ? "rounded-pill" : "rounded-md")}>
        {children}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 ring-3 ring-text-1 ring-offset-3 ring-offset-bg transition-opacity duration-(--duration-fast)",
            round ? "rounded-pill" : "rounded-md",
            on ? "opacity-100" : "opacity-0"
          )}
        />
        {on && (
          <span aria-hidden="true" className="absolute right-1 bottom-1 grid size-7 place-items-center rounded-pill bg-text-1 text-bg shadow-2">
            <Check className="size-4" />
          </span>
        )}
      </span>
      <span className="truncate text-small font-semibold text-text-1">{label}</span>
      {sub && <span className="-mt-1.5 truncate text-caption text-text-2 tracking-normal">{sub}</span>}
    </button>
  );
}
