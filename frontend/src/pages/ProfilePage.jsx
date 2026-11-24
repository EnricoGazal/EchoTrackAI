import { ArrowRight, RefreshCw } from "lucide-react";
import { useApp } from "../features/shell/context";
import { Button } from "../ui/button";
import { SectionHeader } from "../ui/section";
import { AiMark, TickMeter } from "../features/ai/AiLayer";

const LABELS = { energy: "Energia", valence: "Alegria", danceability: "Dançante", acousticness: "Acústica" };
const fmt = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Resultado do questionário: traços e o perfil sonoro. */
export function ProfilePage() {
  const { user, hint, navigate, onRedo } = useApp();
  const profile = user.profile;

  if (!profile) return null;

  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-5xl gap-12 px-4 py-8 sm:px-8 sm:py-12">
      <header className="grid gap-4">
        <AiMark className="w-fit">Analisado pelo EchoTrack AI</AiMark>
        <p className="text-small text-text-2">Seu perfil musical</p>
        <h1 className="font-display-tight text-hero-m font-heavy text-balance">{profile.title}</h1>
        <p className="max-w-[60ch] text-body text-text-2">
          {user.name}, a IA analisou suas respostas e as características de áudio das músicas que você escolheu.
          Este é o seu som.
        </p>
        {hint?.firstTime && (
          <Button variant="primary" size="lg" className="mt-2 w-fit" onClick={() => navigate({ name: "home" })}>
            Ir para o EchoTrack <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </header>

      <section className="grid gap-6">
        <article className="grid content-start gap-4 rounded-lg bg-surface-1 p-6 shadow-1 ring-1 ring-border/70">
          <h2 className="text-caption uppercase text-text-2">Traços</h2>
          <ul className="grid gap-4">
            {profile.traits.map((t) => (
              <li key={t.label}>
                <p className="font-display-wide text-heading font-semibold">{t.label}</p>
                <p className="text-small text-text-2">{t.description}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid gap-6">
        <SectionHeader title="Como é o seu som" subtitle="Seu perfil comparado com a média das quase 90 mil músicas do catálogo." />
        <div className="grid gap-6 rounded-lg bg-surface-1 p-6 shadow-1 ring-1 ring-border/70">
          <p className="flex flex-wrap items-center gap-4 text-caption text-text-2 tracking-normal">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-1 rounded-pill bg-ai" /> Você
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-0.5 rounded-pill bg-text-1" /> Média do catálogo
            </span>
          </p>
          <ul className="grid gap-5 md:grid-cols-2 md:gap-x-10">
            {Object.entries(LABELS).map(([key, label]) => (
              <li key={key} className="grid gap-2">
                <span className="flex items-baseline justify-between text-small">
                  <span className="font-medium text-text-1">{label}</span>
                  <span className="tabular text-text-2">
                    <span className="font-semibold text-ai">{fmt(profile.features[key])}</span>
                    <span className="text-text-3"> / </span>
                    {fmt(profile.catalog[key])}
                  </span>
                </span>
                <TickMeter seed={profile.catalog[key]} rec={profile.features[key]} />
                <span className="sr-only">
                  Você {fmt(profile.features[key])}, média do catálogo {fmt(profile.catalog[key])}
                </span>
              </li>
            ))}
          </ul>
          <dl className="grid gap-4 border-t border-border/70 pt-5 text-small sm:grid-cols-2">
            <div>
              <dt className="text-caption text-text-3 tracking-normal">Gêneros</dt>
              <dd className="text-text-1">{profile.top_genres.join(", ") || "–"}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-3 tracking-normal">Andamento médio</dt>
              <dd className="tabular text-text-1">{profile.tempo} BPM</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="lg" onClick={() => navigate({ name: "home" })}>
          Ver o que a IA separou para você <ArrowRight aria-hidden="true" />
        </Button>
        <Button size="lg" onClick={onRedo}>
          <RefreshCw aria-hidden="true" /> Refazer questionário
        </Button>
      </div>
    </div>
  );
}
