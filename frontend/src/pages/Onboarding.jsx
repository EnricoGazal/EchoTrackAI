import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { getGenres, getOnboardingArtists, getOnboardingOptions, sendOnboarding } from "../api";
import { Button } from "../ui/button";
import { Cover } from "../ui/cover";
import { Logo } from "../ui/logo";
import { Notice } from "../ui/section";
import { Skeleton } from "../ui/skeleton";
import { cleanTitle, formatArtists } from "../utils";
import { cn } from "../lib/utils";

// Cada pergunta tem uma palavra em itálico: é o que a IA está tentando aprender.
const STEPS = [
  { id: "genres", title: ["Quais ", "gêneros", " você curte?"], hint: "Escolha quantos quiser." },
  { id: "artists", title: ["Escolha 3 ou mais ", "artistas", " que você curte."], hint: "Eles viram pontos de partida para a IA entender o seu som." },
  { id: "era", title: ["O que tocava quando você tinha ", "uns 15 anos", "?"], hint: "Marque as que lembram a sua adolescência. Se nenhuma, é só continuar." },
  { id: "contexts", title: ["Quando você mais ", "ouve", " música?"], hint: "Escolha quantos quiser." },
];

/** Questionário inicial: uma pergunta por tela. */
export function Onboarding({ name, onDone }) {
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState([]);
  const [options, setOptions] = useState(null);
  const [artists, setArtists] = useState(null);
  const [answers, setAnswers] = useState({ genres: [], artists: [], era_songs: [], contexts: [] });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    getGenres().then((d) => setGenres(d.details)).catch(() => {});
    getOnboardingOptions().then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    if (STEPS[step].id !== "artists") return undefined;
    const controller = new AbortController();
    setArtists(null);
    getOnboardingArtists(answers.genres, { signal: controller.signal }).then((d) => setArtists(d.artists)).catch(() => {});
    return () => controller.abort();
  }, [step, answers.genres]);

  const toggle = (field, value) =>
    setAnswers((a) => ({ ...a, [field]: a[field].includes(value) ? a[field].filter((v) => v !== value) : [...a[field], value] }));

  const current = STEPS[step];
  const canGo =
    (current.id === "genres" && answers.genres.length > 0) ||
    (current.id === "artists" && answers.artists.length >= 3) ||
    current.id === "era" ||
    current.id === "contexts";

  async function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
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
    <div className="theme-paper flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-(--glass-bg) backdrop-blur-(--glass-blur)">
        <div className="mx-auto flex h-18 max-w-5xl items-center gap-6 px-6 sm:px-10">
          <Logo withName={false} />
          <div
            className="grid flex-1 grid-cols-4 gap-1.5"
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
              <h1 className="font-serif text-[clamp(2.5rem,1.8rem+3.4vw,4.25rem)] leading-[1.02] tracking-[-0.02em] text-balance text-text-1">
                {current.title[0]}
                <em>{current.title[1]}</em>
                {current.title[2]}
              </h1>
              {step === 0 && <p className="text-body text-text-2">{current.hint}</p>}
            </div>

            {current.id === "genres" && (
              <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2.5">
                {genres.length
                  ? genres.map((g) => (
                      <Chip key={g.genre} on={answers.genres.includes(g.genre)} onClick={() => toggle("genres", g.genre)}>
                        {g.label}
                      </Chip>
                    ))
                  : Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-11 w-28 rounded-pill" />)}
              </div>
            )}

            {current.id === "artists" && (
              <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
                {(artists ?? Array.from({ length: 12 }, () => null)).map((a, i) =>
                  a ? (
                    <li key={a.name}>
                      <Pick on={answers.artists.includes(a.name)} onClick={() => toggle("artists", a.name)} round label={a.name}>
                        <Cover song={{ track_id: a.image_track_id }} className="w-full rounded-pill" />
                      </Pick>
                    </li>
                  ) : (
                    <li key={i} className="grid gap-2">
                      <Skeleton className="aspect-square w-full rounded-pill" />
                      <Skeleton className="mx-auto h-3 w-2/3" />
                    </li>
                  )
                )}
              </ul>
            )}

            {current.id === "era" && options && (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
                {options.era_songs.map((s) => (
                  <li key={s.track_id}>
                    <Pick on={answers.era_songs.includes(s.track_id)} onClick={() => toggle("era_songs", s.track_id)} label={cleanTitle(s.track_name)} sub={formatArtists(s.artists)}>
                      <Cover song={s} className="w-full rounded-md" />
                    </Pick>
                  </li>
                ))}
              </ul>
            )}

            {current.id === "contexts" && options && (
              <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2.5">
                {options.contexts.map((c) => (
                  <Chip key={c.id} on={answers.contexts.includes(c.id)} onClick={() => toggle("contexts", c.id)}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            )}

            {error && <Notice tone="danger">{error}</Notice>}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="sticky bottom-0 bg-(--glass-bg) backdrop-blur-(--glass-blur)">
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
              <Button variant="ghost" size="lg" onClick={() => setStep(step - 1)}>
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

function Chip({ on, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-pill px-6 text-body transition-[background-color,color,transform] duration-(--duration-base) ease-out active:scale-[0.97]",
        on ? "bg-text-1 text-bg" : "bg-surface-1 text-text-1 ring-1 ring-border hover:bg-surface-2 hover:ring-border-strong"
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
