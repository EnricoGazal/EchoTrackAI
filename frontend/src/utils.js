export const formatArtists = (artists = "") =>
  artists.split(";").map((a) => a.trim()).filter(Boolean).join(", ");

// Tira sufixos de remasterização para o título ficar limpo.
export const cleanTitle = (title = "") =>
  title.replace(/\s+-\s+(\d{4}\s+)?Remaster(ed)?(\s+\d{4})?$/i, "");

export const formatDuration = (ms) => {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export const percent = (v) => `${Math.round(Math.max(v, 0) * 100)}%`;

export const numberBR = (n) => new Intl.NumberFormat("pt-BR").format(n);

// Nome do gênero como o usuário lê: "hip-hop" vira "Hip-hop".
export const genreLabel = (g = "") => g.charAt(0).toUpperCase() + g.slice(1);

// Lista de artistas de uma música ("A;B" vira ["A", "B"]).
export const splitArtists = (artists = "") =>
  artists.split(";").map((a) => a.trim()).filter(Boolean);

export const formatTime = (ms) => {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
