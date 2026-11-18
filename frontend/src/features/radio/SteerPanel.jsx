import { useId } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Slider } from "../../ui/slider";
import { Switch } from "../../ui/switch";
import { Button } from "../../ui/button";
import { ScanLine } from "../../ui/skeleton";
import { AiMark } from "../ai/AiLayer";
import { cn } from "../../lib/utils";

export const DEFAULT_LAMBDA = 0.75;
// "Parecido ↔ Variado" (0–1) ↔ λ do MMR (1 = só parecidas, 0,3 = bem variado).
export const lambdaFromVariety = (v) => Math.round((1 - 0.7 * v) * 100) / 100;
export const varietyFromLambda = (lam) => (1 - lam) / 0.7;

const STEERS = [
  { key: "energy", label: "Energia", low: "Mais calma", high: "Mais energia" },
  { key: "acousticness", label: "Acústica", low: "Mais elétrica", high: "Mais acústica" },
  { key: "valence", label: "Alegria", low: "Mais melancólica", high: "Mais alegre" },
];

const fmt = (v) => (v == null ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/**
 * Controles do rádio dirigível. Cada controle muda o ponto de partida da
 * busca (ou o λ do MMR) e a lista é refeita na hora.
 */
export function SteerPanel({ value, onChange, onReset, seed, target, status, features = true, className }) {
  const id = useId();
  const { steer, variety, obscure } = value;
  const dirty = obscure || Math.abs(variety - varietyFromLambda(DEFAULT_LAMBDA)) > 0.01 || Object.values(steer).some((v) => v);

  const setSteer = (key, v) => onChange({ ...value, steer: { ...steer, [key]: v } });

  return (
    <section aria-labelledby={`${id}-t`} className={cn("grid gap-6 rounded-lg bg-surface-1 p-5 shadow-1 ring-1 ring-border/70", className)}>
      <header className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <AiMark size="sm">EchoTrack AI</AiMark>
          <Button variant="ghost" size="sm" onClick={onReset} disabled={!dirty}>
            <RotateCcw aria-hidden="true" /> Voltar ao original
          </Button>
        </div>
        <div>
          <h2 id={`${id}-t`} className="flex items-center gap-2 font-display-wide text-title font-semibold">
            <SlidersHorizontal aria-hidden="true" className="size-5 text-ai" /> Rádio dirigível
          </h2>
          <p className="mt-1 text-small text-text-2">Puxe a playlist para onde quiser. O modelo refaz a lista na hora.</p>
        </div>
      </header>

      {features &&
        STEERS.map((s) => {
          const v = steer[s.key] || 0;
          const from = seed?.[s.key];
          const to = target?.[s.key];
          return (
            <div key={s.key} className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-small font-medium text-text-1">{s.label}</span>
                <span className="text-caption tabular text-text-2 tracking-normal">
                  {fmt(from)}
                  {v !== 0 && to != null && (
                    <>
                      {" → "}
                      <span className="font-semibold text-ai">{fmt(to)}</span>
                    </>
                  )}
                </span>
              </div>
              <Slider
                bipolar
                min={-100}
                max={100}
                step={10}
                value={[Math.round(v * 100)]}
                onValueChange={([n]) => setSteer(s.key, n / 100)}
                aria-label={`${s.label}: de ${s.low.toLowerCase()} a ${s.high.toLowerCase()}`}
                aria-valuetext={v === 0 ? "Igual à música de partida" : `${v > 0 ? s.high : s.low} (${Math.abs(Math.round(v * 100))}%)`}
              />
              <div className="flex justify-between text-caption text-text-3 tracking-normal">
                <span>{s.low}</span>
                <span>{s.high}</span>
              </div>
            </div>
          );
        })}

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-small font-medium text-text-1">Parecido ↔ Variado</span>
          <span className="text-caption tabular text-text-2 tracking-normal">λ {fmt(lambdaFromVariety(variety))}</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[Math.round(variety * 100)]}
          onValueChange={([n]) => onChange({ ...value, variety: n / 100 })}
          aria-label="Equilíbrio entre parecido e variado"
          aria-valuetext={`λ ${fmt(lambdaFromVariety(variety))}`}
        />
        <p className="text-caption text-text-3 tracking-normal">
          É o λ do MMR: quanto mais à direita, mais músicas entram “para variar”.
        </p>
      </div>

      <label className="flex items-start justify-between gap-4">
        <span>
          <span className="block text-small font-medium text-text-1">Fora da bolha</span>
          <span className="block text-caption text-text-2 tracking-normal">
            Prefere músicas pouco conhecidas com o mesmo som. O contrário do viés de popularidade.
          </span>
        </span>
        <Switch checked={obscure} onCheckedChange={(on) => onChange({ ...value, obscure: on })} aria-label="Fora da bolha" />
      </label>

      <div className="grid gap-2" aria-live="polite">
        <ScanLine active={status.loading} />
        <p className="text-caption text-text-2 tracking-normal">{status.text}</p>
      </div>
    </section>
  );
}
