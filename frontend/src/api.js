// Todas as chamadas passam por /api, que o Vite repassa para o FastAPI
// (veja vite.config.js). Em produção, a própria API entrega o site.
const BASE = (import.meta.env.VITE_API_URL || "") + "/api";

// Sessão: o token do login fica no navegador para não pedir login a cada visita.
const TOKEN_KEY = "echotrack-token";
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* navegador sem armazenamento: a sessão dura só esta aba */
  }
}

async function request(path, { signal, method = "GET", body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(BASE + path, {
      signal,
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    const offline = new Error("offline");
    offline.kind = "offline";
    throw offline;
  }
  if (!response.ok) {
    let detail = `Erro ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      /* resposta sem JSON */
    }
    const error = new Error(detail);
    error.status = response.status;
    error.kind = response.status >= 500 ? "offline" : "http";
    throw error;
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Cache das decisões do modelo
// ---------------------------------------------------------------------------
// Recomendações e pontes ficam guardadas no navegador: voltar a uma posição
// dos controles, reabrir uma playlist ou clicar numa música pré-carregada
// (ao passar o mouse) responde na hora. Pedidos iguais em andamento são
// compartilhados, e cancelar um pedido não cancela o cálculo para os outros.
const cache = new Map();
const inflight = new Map();
const CACHE_LIMIT = 150;

function cachedGet(path, { signal } = {}) {
  if (cache.has(path)) {
    const data = cache.get(path);
    cache.delete(path);
    cache.set(path, data);
    return Promise.resolve(data);
  }
  let shared = inflight.get(path);
  if (!shared) {
    shared = request(path)
      .then((data) => {
        cache.set(path, data);
        if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
        return data;
      })
      .finally(() => inflight.delete(path));
    inflight.set(path, shared);
  }
  if (!signal) return shared;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Cancelado", "AbortError"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    shared.then(resolve, reject);
  });
}

export const isCached = (path) => cache.has(path);

const query = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

// Endereço da capa do álbum (a API redireciona para a imagem do Spotify).
export const coverUrl = (trackId) => `${BASE}/cover/${encodeURIComponent(trackId)}`;

export const getHealth = (o) => request("/health", o);
export const getPopular = (limit = 12, o) => cachedGet(`/popular?limit=${limit}`, o);
export const getGenres = (o) => cachedGet("/genres", o);
export const searchSongs = (q, limit = 8, o) =>
  request(`/search?q=${encodeURIComponent(q)}&limit=${limit}`, o);
export const getArtist = (name, o) => cachedGet(`/artist?name=${encodeURIComponent(name)}`, o);

/**
 * Rádio a partir de uma música, com os controles do "rádio dirigível".
 * steer = { energy, acousticness, valence } de -1 a 1; lam = λ do MMR.
 */
export function radioPath(id, { n = 10, lam = 0.75, steer = {}, obscure = false } = {}) {
  const params = { n, lam: Number(lam).toFixed(2) };
  for (const k of ["energy", "acousticness", "valence"]) {
    const v = Math.round((steer[k] || 0) * 10) / 10; // passos de 0,1: mais acertos no cache
    if (v) params[k] = v.toFixed(1);
  }
  if (obscure) params.obscure = "true";
  return `/recommend/${encodeURIComponent(id)}?${query(params)}`;
}
export const getRadio = (id, opts, o) => cachedGet(radioPath(id, opts), o);
export const prefetchRadio = (id, opts) => getRadio(id, opts).catch(() => {});

export const recommendFromGenre = (genre, { n = 10, lam = 0.75, obscure = false } = {}, o) =>
  cachedGet(
    `/recommend/genre/${encodeURIComponent(genre)}?${query({ n, lam: Number(lam).toFixed(2), obscure: obscure ? "true" : undefined })}`,
    o
  );

export const bridgePath = (from, to, { n = 12, obscure = false } = {}) =>
  `/bridge?${query({ from, to, n, obscure: obscure ? "true" : undefined })}`;
export const getBridge = (from, to, opts, o) => cachedGet(bridgePath(from, to, opts), o);

// Contas e perfil
export const signup = (data) => request("/auth/signup", { method: "POST", body: data });
export const login = (data) => request("/auth/login", { method: "POST", body: data });
export const logout = () => request("/auth/logout", { method: "POST", body: {} });


export const getMe = (o) => request("/me", o);
export const deleteAccount = () => request("/me", { method: "DELETE" });
export const getOnboardingOptions = (o) => cachedGet("/onboarding/options", o);
export const getOnboardingArtists = (genres, o) =>
  request(`/onboarding/artists?genres=${encodeURIComponent(genres.join(","))}&limit=30`, o);
export const sendOnboarding = (answers) => request("/onboarding", { method: "POST", body: answers });
export const getForYou = (n = 12, o) => request(`/me/for-you?n=${n}`, o);
