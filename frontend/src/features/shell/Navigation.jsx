import { Compass, House, Library, Search, UserRound } from "lucide-react";
import { Logo } from "../../ui/logo";
import { numberBR } from "../../utils";
import { cn } from "../../lib/utils";

export const NAV = [
  { name: "home", label: "Início", icon: House },
  { name: "discover", label: "Descobrir", icon: Compass },
  { name: "profile", label: "Seu perfil musical", short: "Perfil", icon: UserRound },
  { name: "library", label: "Biblioteca", icon: Library },
];

export function Sidebar({ active, onNavigate, health, account }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-border/60 bg-bg/80 p-4 backdrop-blur-md md:flex">
      <button type="button" onClick={() => onNavigate({ name: "home" })} className="w-fit rounded-sm px-2 pt-2" aria-label="EchoTrack, ir para o início">
        <Logo />
      </button>


      <nav aria-label="Principal">
        <ul className="grid gap-1">
          {NAV.map(({ name, label, icon: Icon }) => {
            const on = active === name;
            return (
              <li key={name}>
                <button
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => onNavigate({ name })}
                  className={cn(
                    "relative flex h-11 w-full items-center gap-3 rounded-md px-3 text-small font-medium transition-colors duration-(--duration-fast)",
                    on ? "bg-surface-2 text-text-1" : "text-text-2 hover:bg-surface-1 hover:text-text-1"
                  )}
                >
                  {on && <span aria-hidden="true" className="absolute inset-y-2.5 left-0 w-1 rounded-pill bg-brand" />}
                  <Icon aria-hidden="true" className={cn("size-5", on && "text-brand")} />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto grid gap-3 pb-24">
        <HealthStatus health={health} />
        {account}
      </div>
    </aside>
  );
}

export function HealthStatus({ health, className }) {
  const ok = health.state === "ok";
  return (
    <p className={cn("flex items-center gap-2 px-2 text-caption text-text-2 tracking-normal", className)}>
      <span aria-hidden="true" className={cn("size-2 rounded-pill", ok ? "bg-ai" : health.state === "checking" ? "bg-text-3" : "bg-danger")} />
      {ok
        ? `Modelo ativo · ${numberBR(health.n_songs)} músicas`
        : health.state === "checking"
        ? "Conectando ao modelo…"
        : "API desligada"}
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
