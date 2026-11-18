import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { Compass, Disc3, Mic2, Search, Shapes } from "lucide-react";
import { getGenres, prefetchRadio, searchSongs } from "../../api";
import { getLibrary } from "../../lib/library";
import { Cover } from "../../ui/cover";
import { cleanTitle, formatArtists } from "../../utils";
import { cn } from "../../lib/utils";

/** Busca com pausa curta enquanto digita; cancela a anterior. */
function useSearch(q, { pickSong, active = true } = {}) {
  const [data, setData] = useState({ results: [], artists: [] });
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (active) getGenres().then((d) => setGenres(d.details)).catch(() => {});
  }, [active]);

  useEffect(() => {
    clearTimeout(timer.current);
    const text = q.trim();
    if (!text) {
      setData({ results: [], artists: [] });
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    timer.current = setTimeout(() => {
      searchSongs(text, 8, { signal: controller.signal })
        .then((d) => {
          setData(d);
          setLoading(false);
          // A primeira música já fica pronta: abrir a playlist dela é imediato.
          if (d.results[0] && !pickSong) prefetchRadio(d.results[0].track_id);
        })
        .catch((err) => err.name !== "AbortError" && setLoading(false));
    }, 120);
    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
  }, [q, pickSong]);

  return { data, genres, loading };
}

const ITEM = "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-small outline-none data-[selected=true]:bg-surface-3/70";
const GROUP =
  "px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:text-text-3";

/** Grupos de resultado (músicas, artistas, gêneros), usados pela busca ⌘K e pela barra da Início. */
function SearchResults({ q, data, genres, loading, pickSong, onSong, onArtist, onGenre, onAction }) {
  const text = q.trim();
  const recent = !text ? getLibrary().tracks.slice(0, 5) : [];
  const matchingGenres =
    text && !pickSong ? genres.filter((g) => g.label.toLowerCase().includes(text.toLowerCase())).slice(0, 4) : [];

  return (
    <>
      {loading && (
        <Command.Loading>
          <p className="px-3 py-3 text-small text-text-2">Buscando…</p>
        </Command.Loading>
      )}
      {!loading && text && (
        <Command.Empty className="px-3 py-6 text-center text-small text-text-2">Nada encontrado para “{q}”.</Command.Empty>
      )}

      {recent.length > 0 && (
        <Command.Group heading="Ouvidas recentemente" className={GROUP}>
          {recent.map((s) => (
            <Command.Item key={`r-${s.track_id}`} value={`r-${s.track_id}`} onSelect={() => onSong(s)} className={ITEM}>
              <Cover song={s} className="size-9 rounded-xs shadow-none" />
              <span className="min-w-0">
                <span className="block truncate text-text-1">{cleanTitle(s.track_name)}</span>
                <span className="block truncate text-caption text-text-2 tracking-normal">{formatArtists(s.artists)}</span>
              </span>
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {!text && !pickSong && onAction && (
        <Command.Group heading="Atalhos" className={GROUP}>
          <Command.Item value="ponte" onSelect={() => onAction("bridge")} className={ITEM}>
            <Compass aria-hidden="true" className="size-4 text-ai" /> Criar uma ponte entre duas músicas
          </Command.Item>
        </Command.Group>
      )}

      {data.results.length > 0 && (
        <Command.Group heading="Músicas" className={GROUP}>
          {data.results.map((s) => (
            <Command.Item key={s.track_id} value={s.track_id} onSelect={() => onSong(s)} className={ITEM}>
              <Cover song={s} className="size-9 rounded-xs shadow-none" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-text-1">{cleanTitle(s.track_name)}</span>
                <span className="block truncate text-caption text-text-2 tracking-normal">
                  {formatArtists(s.artists)}
                  {s.album_name ? ` · ${s.album_name}` : ""}
                </span>
              </span>
              <Disc3 aria-hidden="true" className="size-4 shrink-0 text-text-3" />
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {!pickSong && data.artists?.length > 0 && (
        <Command.Group heading="Artistas" className={GROUP}>
          {data.artists.map((a) => (
            <Command.Item key={a.name} value={`a-${a.name}`} onSelect={() => onArtist(a.name)} className={ITEM}>
              <Cover song={{ track_id: a.image_track_id }} className="size-9 rounded-pill shadow-none" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-text-1">{a.name}</span>
                <span className="block text-caption text-text-2 tracking-normal">Artista · {a.n_songs} músicas</span>
              </span>
              <Mic2 aria-hidden="true" className="size-4 shrink-0 text-text-3" />
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {matchingGenres.length > 0 && (
        <Command.Group heading="Gêneros" className={GROUP}>
          {matchingGenres.map((g) => (
            <Command.Item key={g.genre} value={`g-${g.genre}`} onSelect={() => onGenre(g)} className={ITEM}>
              <span className="grid size-9 place-items-center rounded-xs bg-surface-3">
                <Shapes aria-hidden="true" className="size-4 text-text-2" />
              </span>
              <span className="text-text-1">{g.label}</span>
            </Command.Item>
          ))}
        </Command.Group>
      )}
    </>
  );
}

/**
 * Busca no estilo "command palette" (⌘K / Ctrl+K): músicas, artistas e
 * gêneros. Com `pickSong`, vira um seletor de música (usado na Ponte).
 */
export function CommandSearch({ open, onOpenChange, onSong, onArtist, onGenre, onAction, pickSong, title = "Buscar" }) {
  const [q, setQ] = useState("");
  const search = useSearch(q, { pickSong, active: open });

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const close = () => onOpenChange(false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-[fade-in_var(--duration-fast)_var(--ease-out)]" />
        <Dialog.Content
          className="fixed top-[12dvh] left-1/2 z-50 w-[min(40rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-lg bg-(--glass-bg) shadow-3 ring-1 ring-(--glass-ring) backdrop-blur-(--glass-blur) data-[state=open]:animate-[pop-in_var(--duration-base)_var(--ease-out)] focus-visible:outline-none"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">Digite o nome de uma música, artista ou gênero.</Dialog.Description>
          <Command shouldFilter={false} loop label={title}>
            <div className="flex items-center gap-3 border-b border-(--glass-ring) px-4">
              <Search aria-hidden="true" className="size-5 shrink-0 text-text-2" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                autoFocus
                placeholder={pickSong ? "Busque a música…" : "Música, artista ou gênero"}
                className="h-14 w-full bg-transparent text-body text-text-1 placeholder:text-text-3 focus:outline-none"
              />
              <kbd className="hidden rounded-xs bg-surface-3 px-1.5 py-0.5 text-caption text-text-2 tracking-normal sm:block">Esc</kbd>
            </div>
            <Command.List className="max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain p-1.5">
              <SearchResults
                q={q}
                {...search}
                pickSong={pickSong}
                onSong={(s) => {
                  close();
                  (pickSong || onSong)?.(s);
                }}
                onArtist={(name) => {
                  close();
                  onArtist?.(name);
                }}
                onGenre={(g) => {
                  close();
                  onGenre?.(g);
                }}
                onAction={
                  onAction &&
                  ((a) => {
                    close();
                    onAction(a);
                  })
                }
              />
            </Command.List>
          </Command>
          <p className={cn("hidden items-center gap-4 border-t border-(--glass-ring) px-4 py-2 text-caption text-text-3 tracking-normal sm:flex")}>
            <span>↑↓ navegar</span>
            <span>↵ abrir</span>
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Barra de busca grande (Início): os resultados aparecem logo abaixo,
 * enquanto a pessoa digita. Setas escolhem, Enter abre, Esc fecha.
 */
export function HeroSearch({ onSong, onArtist, onGenre, className }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const search = useSearch(q, { active: open });
  const box = useRef(null);
  const input = useRef(null);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const done = (fn) => (arg) => {
    setOpen(false);
    setQ("");
    input.current?.blur();
    fn?.(arg);
  };
  const hasRecent = getLibrary().tracks.length > 0;
  const showList = open && (q.trim() || hasRecent);

  return (
    <div ref={box} className={cn("relative w-full", className)}>
      <Command shouldFilter={false} loop label="Buscar no EchoTrack">
        <div
          className={cn(
            "flex h-16 items-center gap-4 rounded-pill bg-surface-1 px-6 shadow-2 ring-1 ring-border transition-[box-shadow,background-color] duration-(--duration-fast)",
            "focus-within:bg-surface-2 focus-within:ring-2 focus-within:ring-focus hover:ring-border-strong"
          )}
        >
          <Search aria-hidden="true" className="size-6 shrink-0 text-text-2" />
          <Command.Input
            ref={input}
            value={q}
            onValueChange={(v) => {
              setQ(v);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                input.current?.blur();
              }
            }}
            placeholder="Busque uma música, artista ou gênero"
            className="h-full w-full min-w-0 bg-transparent text-heading text-text-1 placeholder:text-text-3 focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded-xs bg-surface-3 px-2 py-1 text-caption text-text-2 tracking-normal sm:block">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </div>
        {showList && (
          <Command.List className="absolute inset-x-0 top-full z-30 mt-2 max-h-[min(60dvh,26rem)] overflow-y-auto overscroll-contain rounded-lg bg-(--glass-bg) p-1.5 shadow-3 ring-1 ring-(--glass-ring) backdrop-blur-(--glass-blur) animate-[pop-in_var(--duration-fast)_var(--ease-out)]">
            <SearchResults q={q} {...search} onSong={done(onSong)} onArtist={done(onArtist)} onGenre={done(onGenre)} />
          </Command.List>
        )}
      </Command>
    </div>
  );
}
