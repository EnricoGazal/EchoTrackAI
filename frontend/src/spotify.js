/*
 * Conexão com a conta Spotify Premium do usuário, para tocar músicas
 * inteiras dentro do EchoTrack (Web Playback SDK).
 *
 * - Login com o Spotify pelo fluxo "Authorization Code com PKCE": roda todo no
 *   navegador e não precisa de chave secreta, só do Client ID do app criado
 *   no painel do Spotify (variável VITE_SPOTIFY_CLIENT_ID em .env.local).
 * - O Web Playback SDK cria um "aparelho" chamado EchoTrack na conta da
 *   pessoa; a Web API manda esse aparelho tocar cada música.
 * - Exige Spotify Premium de quem ouve. Sem conexão, o EchoTrack continua
 *   usando o player embutido (prévia de 30 s).
 */

// Client ID: no computador vem do .env.local; no site publicado, da API
// (variável SPOTIFY_CLIENT_ID no servidor), carregado por loadConfig().
let CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";
const API_BASE = (import.meta.env.VITE_API_URL || "") + "/api";

export async function loadConfig() {
  if (CLIENT_ID) return;
  try {
    const response = await fetch(`${API_BASE}/config`);
    CLIENT_ID = (await response.json()).spotify_client_id || "";
  } catch {
    /* sem configuração: continua com o player de prévia */
  }
}

// Endereço para onde o Spotify volta depois do login.
// - No computador: https://127.0.0.1:5173/callback (o Spotify não aceita "localhost").
// - No site publicado: o próprio endereço do site, ex. https://www.echotrack.com.br/callback.
export function redirectUri() {
  if (import.meta.env.VITE_SPOTIFY_REDIRECT_URI) return import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
  const { protocol, hostname, port, origin } = window.location;
  if (hostname === "127.0.0.1" || hostname === "localhost") {
    return `${protocol}//127.0.0.1:${port || 5173}/callback`;
  }
  return `${origin}/callback`;
}
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

const KEY = "echotrack-spotify";
const PKCE_KEY = "echotrack-spotify-pkce";

export const isConfigured = () => Boolean(CLIENT_ID);

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function save(key, value) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    /* sem armazenamento: a conexão dura só esta aba */
  }
}

export const isConnected = () => Boolean(load(KEY)?.refresh_token);

// ---------------------------------------------------------------------
// Login (PKCE)
// ---------------------------------------------------------------------

const base64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export async function startLogin() {
  if (!window.crypto?.subtle) {
    window.alert("Para conectar o Spotify, abra o EchoTrack pelo endereço com https://");
    return;
  }
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = base64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  );
  save(PKCE_KEY, { verifier, state });
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
    state,
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

async function tokenRequest(params) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Falha no login do Spotify");
  const previous = load(KEY) || {};
  const token = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || previous.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  save(KEY, token);
  return token;
}

let lastError = null;
export const consumeError = () => {
  const e = lastError;
  lastError = null;
  return e;
};

// Chamado ao abrir o app: se voltamos do login do Spotify, troca o código pelo token.
export async function finishLogin() {
  if (window.location.pathname !== "/callback") return;
  const params = new URLSearchParams(window.location.search);
  const pkce = load(PKCE_KEY);
  save(PKCE_KEY, null);
  window.history.replaceState({}, "", "/");
  if (params.get("error")) {
    lastError = "A conexão com o Spotify foi cancelada.";
    return;
  }
  if (!pkce || params.get("state") !== pkce.state) {
    lastError = "Não foi possível confirmar o login do Spotify. Tente conectar de novo.";
    return;
  }
  try {
    await tokenRequest({
      grant_type: "authorization_code",
      code: params.get("code"),
      redirect_uri: redirectUri(),
      code_verifier: pkce.verifier,
    });
  } catch (err) {
    lastError = `Não foi possível conectar ao Spotify: ${err.message}`;
  }
}

export async function getAccessToken() {
  const token = load(KEY);
  if (!token) throw new Error("Spotify não conectado");
  if (Date.now() < token.expires_at) return token.access_token;
  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: token.refresh_token });
  return fresh.access_token;
}

export function disconnect() {
  save(KEY, null);
  sdk.player?.disconnect();
  sdk.player = null;
  sdk.deviceId = null;
  sdk.ready = null;
}

// ---------------------------------------------------------------------
// Web Playback SDK
// ---------------------------------------------------------------------

const sdk = { player: null, deviceId: null, ready: null, listeners: new Set() };

function loadScript() {
  if (window.Spotify) return Promise.resolve();
  return new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
  });
}

/**
 * Cria o aparelho "EchoTrack" na conta do usuário.
 * Resolve com o device_id; rejeita com { kind } em caso de erro:
 * "premium" (conta não é Premium), "auth" (login expirado) ou "init".
 */
export function connectPlayer() {
  if (sdk.ready) return sdk.ready;
  sdk.ready = loadScript().then(
    () =>
      new Promise((resolve, reject) => {
        const player = new window.Spotify.Player({
          name: "EchoTrack",
          getOAuthToken: (cb) => getAccessToken().then(cb).catch(() => cb("")),
          volume: 0.8,
        });
        sdk.player = player;
        const fail = (kind) => ({ message }) => {
          sdk.ready = null;
          reject(Object.assign(new Error(message), { kind }));
        };
        player.addListener("ready", ({ device_id }) => {
          sdk.deviceId = device_id;
          resolve(device_id);
        });
        player.addListener("account_error", fail("premium"));
        player.addListener("authentication_error", fail("auth"));
        player.addListener("initialization_error", fail("init"));
        player.addListener("player_state_changed", (state) => {
          sdk.listeners.forEach((fn) => fn(state));
        });
        player.connect();
      })
  );
  return sdk.ready;
}

export function onStateChange(fn) {
  sdk.listeners.add(fn);
  return () => sdk.listeners.delete(fn);
}

// Precisa ser chamado dentro de um clique: libera o áudio no navegador.
export function activate() {
  sdk.player?.activateElement?.();
}

export async function playTrack(trackId) {
  const token = await getAccessToken();
  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(sdk.deviceId)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
    }
  );
  if (!response.ok && response.status !== 204) {
    let detail = `Erro ${response.status}`;
    try {
      detail = (await response.json()).error?.message || detail;
    } catch {
      /* sem corpo */
    }
    throw new Error(detail);
  }
}

export const togglePlay = () => sdk.player?.togglePlay();
export const seek = (ms) => sdk.player?.seek(ms);
export const setVolume = (v) => sdk.player?.setVolume(v);
