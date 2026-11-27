import { useState } from "react";
import { ArrowRight, Check, RefreshCw } from "lucide-react";
import { confirmAge } from "../api";
import { useApp } from "../features/shell/context";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SectionHeader } from "../ui/section";
import { AiMark, TickMeter } from "../features/ai/AiLayer";

const LABELS = { energy: "Energia", valence: "Alegria", danceability: "Dançante", acousticness: "Acústica" };
const fmt = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Resultado do questionário: palpite de idade, traços e o perfil sonoro. */
export function ProfilePage() {
  const { user, setUser, hint, navigate, onRedo } = useApp();
  const profile = user.profile;
  const [correcting, setCorrecting] = useState(false);
  const [saving, setSaving] = useState(false);

  // answer: { range } quando o palpite acertou, { age } quando a pessoa digitou.
  async function answerAge(answer) {
    setSaving(true);
    try {
      const updated = await confirmAge(answer);
      setUser((u) => ({ ...u, profile: updated }));
      setCorrecting(false);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;
  const guess = profile.age_guess;

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

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="grid content-start gap-4 rounded-lg bg-surface-1 p-6 shadow-1 ring-1 ring-border/70">
          <h2 className="text-caption uppercase text-text-2">Idade</h2>
          {profile.age_confirmed && !correcting ? (
            <>
              <p className="font-display-tight text-stat font-heavy">{profile.age_confirmed}</p>
              <p className="flex items-center gap-1.5 text-small text-text-2">
                <Check className="size-4 text-brand" aria-hidden="true" />
                Confirmado por você. Isso ajuda a IA a errar menos nos próximos palpites.
              </p>
              <Button variant="ghost" size="sm" className="-ml-3 w-fit" onClick={() => setCorrecting(true)}>
                Alterar idade
              </Button>
            </>
          ) : guess && !correcting ? (
            <>
              <p className="font-display-tight text-stat font-heavy tabular">
                {guess.low}–{guess.high}
                <span className="ml-2 font-sans text-body font-regular text-text-2">anos</span>
              </p>
              <p className="text-small text-text-2">
                Palpite feito pelas {guess.based_on} {guess.based_on === 1 ? "música" : "músicas"} que marcaram sua
                adolescência: as músicas que mais nos marcam costumam ser as que ouvimos por volta dos 16 anos.
              </p>
              <p className="text-small font-medium text-text-1">A IA acertou?</p>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" disabled={saving} onClick={() => answerAge({ range: profile.age_range_guess })}>
                  Acertou
                </Button>
                <Button variant="outline" size="sm" disabled={saving} onClick={() => setCorrecting(true)}>
                  Errou
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-small text-text-2">
                {correcting
                  ? "Quantos anos você tem? A IA usa a sua resposta para errar menos nos próximos palpites."
                  : "Quantos anos você tem?"}
              </p>
              <AgeInput
                saving={saving}
                onSave={(age) => answerAge({ age })}
                onCancel={correcting ? () => setCorrecting(false) : null}
              />
            </>
          )}
        </article>

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

/** Campo para a pessoa digitar a própria idade (10 a 100 anos). */
function AgeInput({ saving, onSave, onCancel }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const age = Number(value);
    if (!Number.isInteger(age) || age < 10 || age > 100) {
      setError("Digite uma idade entre 10 e 100 anos.");
      return;
    }
    setError("");
    onSave(age);
  }

  return (
    <form className="grid gap-2" onSubmit={submit} noValidate>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Sua idade</span>
          <Input
            type="number"
            inputMode="numeric"
            min={10}
            max={100}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="20"
            aria-invalid={Boolean(error)}
            className="h-10 w-36 rounded-pill bg-surface-2/70 pr-14 pl-5 tabular shadow-none ring-(--glass-ring) [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-small text-text-3">
            anos
          </span>
        </label>
        <Button type="submit" variant="primary" size="sm" disabled={saving || !value}>
          {saving ? "Salvando…" : "Confirmar"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
      {error && <p className="pl-5 text-small text-danger">{error}</p>}
    </form>
  );
}
