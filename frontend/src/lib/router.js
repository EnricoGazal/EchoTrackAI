import { useEffect, useState } from "react";

// Rotas do EchoTrack. Cada tela tem um endereço próprio, então dá para
// voltar pelo navegador e compartilhar o link de uma playlist ou ponte.
export function parse(loc = window.location) {
  const parts = loc.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(loc.search);
  switch (parts[0]) {
    case "musica":
      return parts[1] ? { name: "song", id: parts[1] } : { name: "home" };
    case "genero":
      return parts[1] ? { name: "genre", id: parts[1] } : { name: "discover" };
    case "artista":
      return parts[1] ? { name: "artist", artist: parts[1] } : { name: "home" };
    case "descobrir":
      return { name: "discover", from: q.get("de") || null, to: q.get("para") || null };
    case "perfil":
      return { name: "profile" };
    case "biblioteca":
      return { name: "library" };
    default:
      return { name: "home" };
  }
}

export function format(route) {
  switch (route.name) {
    case "song":
      return `/musica/${encodeURIComponent(route.id)}`;
    case "genre":
      return `/genero/${encodeURIComponent(route.id)}`;
    case "artist":
      return `/artista/${encodeURIComponent(route.artist)}`;
    case "discover": {
      const q = new URLSearchParams();
      if (route.from) q.set("de", route.from);
      if (route.to) q.set("para", route.to);
      const s = q.toString();
      return `/descobrir${s ? `?${s}` : ""}`;
    }
    case "profile":
      return "/perfil";
    case "library":
      return "/biblioteca";
    default:
      return "/";
  }
}

/**
 * Estado da rota atual + navegação. `hint` carrega dados que a tela de destino
 * já pode mostrar na hora (ex.: a música clicada), sem esperar a API.
 */
export function useRouter() {
  const [state, setState] = useState(() => ({ route: parse(), hint: window.history.state?.hint ?? null }));

  useEffect(() => {
    const onPop = (e) => setState({ route: parse(), hint: e.state?.hint ?? null });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(route, { hint = null, replace = false } = {}) {
    const url = format(route);
    const same = url === window.location.pathname + window.location.search;
    const method = replace || same ? "replaceState" : "pushState";
    window.history[method]({ hint }, "", url);
    setState({ route: { ...route }, hint });
    if (!same) window.scrollTo({ top: 0 });
  }

  return { ...state, navigate };
}
