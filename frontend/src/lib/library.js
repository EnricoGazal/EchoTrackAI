// "Biblioteca": o que a pessoa ouviu e as playlists que gerou, guardado só
// neste navegador (conveniência pessoal; nada vai para o servidor).
const KEY = "echotrack-library";
const LIMIT = 30;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { tracks: [], playlists: [] };
  } catch {
    return { tracks: [], playlists: [] };
  }
}
function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* sem armazenamento: a biblioteca fica vazia */
  }
}

const slim = (s) => ({
  track_id: s.track_id,
  track_name: s.track_name,
  artists: s.artists,
  album_name: s.album_name,
  genre_group: s.genre_group,
  duration_ms: s.duration_ms,
  energy: s.energy,
  valence: s.valence,
  danceability: s.danceability,
  loudness: s.loudness,
  tempo: s.tempo,
});

export function rememberTrack(song) {
  const data = read();
  data.tracks = [{ ...slim(song), at: Date.now() }, ...data.tracks.filter((t) => t.track_id !== song.track_id)].slice(0, LIMIT);
  write(data);
}

/** entry: { kind: "song" | "genre" | "bridge", id, title, subtitle, cover } */
export function rememberPlaylist(entry) {
  const data = read();
  const key = `${entry.kind}:${entry.id}`;
  data.playlists = [{ ...entry, key, at: Date.now() }, ...data.playlists.filter((p) => p.key !== key)].slice(0, LIMIT);
  write(data);
}

export const getLibrary = read;
export function clearLibrary() {
  write({ tracks: [], playlists: [] });
}
