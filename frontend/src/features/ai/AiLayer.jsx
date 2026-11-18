import { Crosshair, Info, Radio, Shuffle } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { cleanTitle } from "../../utils";
import { cn } from "../../lib/utils";
import { explain, PICK_COPY } from "./explain";

/** Selo único de tudo que vem do modelo. O ícone de ondas = "eco". */
export function AiMark({ className, size = "md", children = "EchoTrack AI" }) {
  return (
    <Badge variant="ai" size={size} className={className}>
      <Radio aria-hidden="true" />
      {children}
    </Badge>
  );
}

/** Selo em cima; embaixo, de onde veio: "Porque você escolheu X", "Porque você curte Y"... */
export function AiOrigin({ origin, className, align = "center" }) {
  if (!origin) return null;
  return (
    <div className={cn("flex flex-col gap-2", align === "center" ? "items-center text-center" : "items-start", className)}>
      <AiMark>Recomendado pelo EchoTrack AI</AiMark>
      <p className="text-small text-text-2">
        {origin.text} <strong className="font-semibold text-text-1">{origin.strong}</strong>
      </p>
    </div>
  );
}

/** Versão em uma linha, para listas e para a barra do player. */
export function AiOriginInline({ origin, className }) {
  if (!origin) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-caption text-text-2 tracking-normal", className)}>
      <Radio aria-hidden="true" className="size-3.5 shrink-0 text-ai" />
      <span className="truncate">
        {origin.text} <span className="text-text-1">{origin.strong}</span>
      </span>
    </span>
  );
}

/** Afinidade = similaridade do cosseno entre os vetores (0–100%). */
export function Affinity({ value, size = "md", showLabel = size === "md", className }) {
  const pct = Math.round(Math.max(0, value) * 100);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn("relative overflow-hidden rounded-pill bg-surface-3", size === "sm" ? "h-1 w-8" : "h-1.5 w-12")}
      >
        <span className="absolute inset-y-0 left-0 rounded-pill bg-ai" style={{ width: `${pct}%` }} />
      </span>
      <span className={cn("tabular font-semibold text-text-1", size === "sm" ? "text-caption" : "text-small")}>
        {pct}%
        {!showLabel ? (
          <span className="sr-only"> de afinidade</span>
        ) : (
          <span className="font-regular text-text-2"> de afinidade</span>
        )}
      </span>
    </span>
  );
}

/** Marca do MMR: entrou por ser muito parecida ou para variar. */
export function PickTag({ pick = "similar", className }) {
  const copy = PICK_COPY[pick] || PICK_COPY.similar;
  const Icon = pick === "diverse" ? Shuffle : Crosshair;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-small font-medium [&_svg]:size-4",
        pick === "diverse" ? "text-text-1 [&_svg]:text-ai" : "text-text-2 [&_svg]:text-text-3",
        className
      )}
    >
      <Icon aria-hidden="true" />
      {copy.label}
    </span>
  );
}

const TICKS = 24;

/**
 * Medidor em barrinhas, na mesma linguagem da forma de onda:
 * barras em ciano até o valor desta música; o traço branco marca a semente.
 */
export function TickMeter({ seed, rec }) {
  const filled = Math.round(rec * TICKS);
  return (
    <span aria-hidden="true" className="relative block h-6">
      <span className="flex h-full items-end gap-0.5">
        {Array.from({ length: TICKS }, (_, i) => (
          <span
            key={i}
            className={cn("flex-1 rounded-xs", i < filled ? "bg-ai" : "bg-(--glass-track)")}
            style={{ height: `${55 + (45 * i) / (TICKS - 1)}%` }}
          />
        ))}
      </span>
      <span
        className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-pill bg-text-1 shadow-2"
        style={{ left: `${Math.min(99, Math.max(1, seed * 100))}%` }}
      />
    </span>
  );
}

/** Conteúdo do "Por que essa?": afinidade, 3 características e o papel no MMR. */
export function WhyContent({ seed, song }) {
  const reasons = explain(seed, song);
  const pick = PICK_COPY[song.pick] || PICK_COPY.similar;
  const seedName = cleanTitle(seed.track_name);
  const pct = Math.round(Math.max(0, song.similarity) * 100);

  return (
    <div className="grid gap-6">
      <header className="grid gap-4">
        <p className="flex items-center gap-2 text-caption uppercase text-text-2 [&_svg]:size-3.5 [&_svg]:text-ai">
          <Radio aria-hidden="true" />
          Por que essa música?
        </p>
        <div className="flex items-end gap-3">
          <span className="font-display-tight text-stat font-heavy tabular text-text-1">{pct}%</span>
          <span className="pb-0.5 text-small leading-tight text-text-2">
            de afinidade com
            <span className="block truncate font-semibold text-text-1">{seedName}</span>
          </span>
        </div>
      </header>

      <div className="grid gap-4">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-2">
          <span>O que mais aproxima as duas</span>
          <span className="ml-auto inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-1 rounded-pill bg-ai" />
              Esta
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-0.5 rounded-pill bg-text-1" />
              Semente
            </span>
          </span>
        </p>
        <ul className="grid gap-4">
          {reasons.map((r) => (
            <li key={r.key} className="grid gap-2">
              <span className="flex items-baseline justify-between gap-3 text-small">
                <span className="font-medium text-text-1">{r.label}</span>
                {r.kind === "bar" ? (
                  <span className="tabular text-text-2">
                    <span className="font-semibold text-ai">{r.recText}</span>
                    <span className="text-text-3"> / </span>
                    {r.seedText}
                    {r.unit && <span className="text-text-3"> {r.unit}</span>}
                  </span>
                ) : (
                  <span className="text-text-2">{r.recText}</span>
                )}
              </span>
              {r.kind === "bar" && <TickMeter seed={r.seed} rec={r.rec} />}
              <span className="sr-only">
                {r.kind === "bar" ? `Esta música ${r.recText}, ${seedName} ${r.seedText}` : `As duas são ${r.recText}`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <footer className="grid gap-1 border-t border-(--glass-ring) pt-4">
        <PickTag pick={song.pick} />
        <p className="text-small text-text-2">{pick.long}</p>
      </footer>
    </div>
  );
}

export function WhyPopover({ seed, song, align = "center", side = "bottom", compact = false }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon-sm" aria-label="Por que essa música?" title="Por que essa música?" className="[&_svg]:text-ai">
            <Info aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="ai" size="sm" className="bg-surface-2/70 backdrop-blur-md">
            <Info aria-hidden="true" />
            Por que essa?
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} side={side} aria-label="Por que essa música foi recomendada">
        <WhyContent seed={seed} song={song} />
      </PopoverContent>
    </Popover>
  );
}
