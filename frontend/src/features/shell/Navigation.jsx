import { Compass, House, Library, PanelLeftClose, PanelLeftOpen, Search, UserRound } from "lucide-react";
import { Tooltip } from "../../ui/tooltip";
import { Logo } from "../../ui/logo";
import { numberBR } from "../../utils";
import { cn } from "../../lib/utils";

export const NAV = [
  { name: "home", label: "Início", icon: House },
  { name: "discover", label: "Descobrir", icon: Compass },
  { name: "profile", label: "Seu perfil musical", short: "Perfil", icon: UserRound },
  { name: "library", label: "Biblioteca", icon: Library },
];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const RAIL_SHORTCUT = isMac ? "⌘B" : "Ctrl+B";

/**
 * Menu lateral flutuante: solto das bordas, cantos arredondados e vidro bem
 * leve. Recolhe para só os ícones (botão na borda ou ⌘B / Ctrl+B).
 */
export function Sidebar({ active, onNavigate, health, account, open, onToggle }) {
  const ToggleIcon = open ? PanelLeftClose : PanelLeftOpen;
  const toggleLabel = open ? "Recolher menu" : "Expandir menu";

  return (
    <aside
      aria-label="Menu"
      data-open={open}
      className={cn(
        "group/rail fixed top-(--rail-gap) bottom-(--rail-gap) left-(--rail-gap) z-30 hidden w-(--rail-w) flex-col gap-6 rounded-xl p-3 md:flex",
        "bg-(--rail-bg) shadow-2 ring-1 ring-(--rail-ring) backdrop-blur-(--rail-blur)",
        "transition-[width] duration-(--duration-base) ease-(--ease-out)"
      )}
    >
      <div className="flex h-12 items-center">
        <button
          type="button"
          onClick={() => onNavigate({ name: "home" })}
          className="flex h-full min-w-0 items-center overflow-hidden rounded-pill px-1.5"
          aria-label="EchoTrack, ir para o início"
        >
          <Logo className="[&>svg]:size-10" withName={false} />
          <span
            className={cn(
              "ml-2.5 font-display-wide text-heading font-semibold whitespace-nowrap tracking-tight transition-opacity duration-(--duration-fast)",
              open ? "opacity-100" : "opacity-0"
            )}
          >
            EchoTrack
          </span>
        </button>
      </div>

      <nav aria-label="Principal" className="min-w-0">
        <ul className="grid grid-cols-1 gap-1">
          {NAV.map(({ name, label, icon: Icon }) => {
            const on = active === name;
            const item = (
              <button
                type="button"
                aria-current={on ? "page" : undefined}
                aria-label={open ? undefined : label}
                onClick={() => onNavigate({ name })}
                className={cn(
                  "flex h-11 w-full items-center gap-3 overflow-hidden rounded-lg px-4 text-small font-medium whitespace-nowrap transition-colors duration-(--duration-fast)",
                  on ? "bg-surface-3/70 text-text-1 shadow-1" : "text-text-2 hover:bg-surface-2/70 hover:text-text-1"
                )}
              >
                <Icon aria-hidden="true" className={cn("size-5 shrink-0", on && "text-brand")} />
                <span className={cn("transition-opacity duration-(--duration-fast)", open ? "opacity-100" : "opacity-0")}>{label}</span>
              </button>
            );
            return <li key={name}>{open ? item : <Tooltip content={label} side="right">{item}</Tooltip>}</li>;
          })}
        </ul>
      </nav>

      <div className="mt-auto grid grid-cols-1 gap-2">
        {/* Recolher / expandir: alinhado com os ícones do menu nos dois estados */}
        <Tooltip content={open ? RAIL_SHORTCUT : `${toggleLabel} · ${RAIL_SHORTCUT}`} side="right">
          <button
            type="button"
            onClick={onToggle}
            aria-label={toggleLabel}
            aria-expanded={open}
            className="flex h-11 w-full items-center gap-3 overflow-hidden rounded-lg px-4 text-small font-medium whitespace-nowrap text-text-2 transition-colors duration-(--duration-fast) hover:bg-surface-2/70 hover:text-text-1"
          >
            <ToggleIcon aria-hidden="true" className="size-5 shrink-0" />
            <span aria-hidden="true" className={cn("transition-opacity duration-(--duration-fast)", open ? "opacity-100" : "opacity-0")}>
              Recolher menu
            </span>
          </button>
        </Tooltip>
        <HealthStatus health={health} compact={!open} />
        <div className="rounded-lg bg-(--account-bg) p-1 shadow-1 ring-1 ring-(--rail-ring)">{account}</div>
      </div>
    </aside>
  );
}

export function HealthStatus({ health, className, compact = false }) {
  const ok = health.state === "ok";
  const text = ok
    ? `Modelo ativo · ${numberBR(health.n_songs)} músicas`
    : health.state === "checking"
    ? "Conectando ao modelo…"
    : "API desligada";
  return (
    <p
      title={compact ? text : undefined}
      className={cn("flex h-6 items-center gap-2 overflow-hidden px-5.5 text-caption whitespace-nowrap text-text-2 tracking-normal", className)}
    >
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", ok ? "bg-ai" : health.state === "checking" ? "bg-text-3" : "bg-danger")} />
      <span className={cn("transition-opacity duration-(--duration-fast)", compact ? "sr-only" : "")}>{text}</span>
    </p>
  );
}

export function MobileTopBar({ onNavigate, onSearch, account }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-bg/85 px-4 backdrop-blur-md md:hidden">
      <button type="button" onClick={() => onNavigate({ name: "home" })} aria-label="EchoTrack, ir para o início">
        <Logo />
      </button>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onSearch} aria-label="Buscar" className="grid size-10 place-items-center rounded-pill text-text-1 hover:bg-surface-2">
          <Search className="size-5" />
        </button>
        {account}
      </div>
    </header>
  );
}

export function BottomNav({ active, onNavigate }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-(--glass-ring) bg-(--glass-bg) pb-[env(safe-area-inset-bottom)] backdrop-blur-(--glass-blur) md:hidden"
    >
      <ul className="grid h-16 grid-cols-4">
        {NAV.map(({ name, label, short, icon: Icon }) => {
          const on = active === name;
          return (
            <li key={name}>
              <button
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => onNavigate({ name })}
                className={cn("flex h-full w-full flex-col items-center justify-center gap-1 text-caption tracking-normal", on ? "text-text-1" : "text-text-2")}
              >
                <Icon aria-hidden="true" className={cn("size-5", on && "text-brand")} />
                {short || label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
