import { cn } from "../../lib/utils";

/** Cabeçalho de playlist: capa à esquerda, texto e ações à direita. */
export function PlaylistHero({ art, kicker, title, meta, actions, className }) {
  return (
    <header className={cn("flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-8", className)}>
      <div className="w-40 shrink-0 lg:w-52">{art}</div>
      <div className="min-w-0 flex-1">
        {kicker && <div className="mb-3">{kicker}</div>}
        <h1 className="font-display-tight text-display font-heavy text-balance [overflow-wrap:anywhere] line-clamp-3">{title}</h1>
        {meta && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-text-2">{meta}</div>}
        {actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

export const Dot = () => <span aria-hidden="true" className="text-text-3">·</span>;
