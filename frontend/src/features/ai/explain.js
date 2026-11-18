// "Por que essa?": compara a música recomendada com a semente usando só os
// valores que a API devolve (nada é inventado). Escolhe as 3 características
// em que as duas mais se aproximam.

const UNIT = [
  ["energy", "Energia"],
  ["danceability", "Dançante"],
  ["valence", "Alegria"],
  ["acousticness", "Acústica"],
  ["instrumentalness", "Instrumental"],
  ["speechiness", "Fala"],
  ["liveness", "Ao vivo"],
];

// Características que podem ser zero nas duas músicas: "nenhuma das duas
// é instrumental" não explica nada, então ficam de fora nesse caso.
const ABSENCE_IS_NOISE = new Set(["acousticness", "instrumentalness", "speechiness", "liveness"]);

const fmt = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Volume em dB (≈ -30 a 0) para 0–1, só para desenhar a barra.
export const loudnessToUnit = (db) => Math.min(1, Math.max(0, ((db ?? -30) + 30) / 30));

export function explain(seed, rec, count = 3) {
  if (!seed || !rec) return [];
  const items = [];

  for (const [key, label] of UNIT) {
    const a = seed[key];
    const b = rec[key];
    if (a == null || b == null) continue;
    if (ABSENCE_IS_NOISE.has(key) && a < 0.08 && b < 0.08) continue;
    items.push({
      key,
      label,
      kind: "bar",
      seed: a,
      rec: b,
      closeness: 1 - Math.abs(a - b),
      recText: fmt(b),
      seedText: fmt(a),
    });
  }

  if (seed.tempo && rec.tempo) {
    const diff = Math.abs(seed.tempo - rec.tempo);
    items.push({
      key: "tempo",
      label: diff <= 3 ? "Mesmo andamento" : "Andamento",
      kind: "bar",
      seed: Math.min(1, seed.tempo / 200),
      rec: Math.min(1, rec.tempo / 200),
      closeness: 1 - Math.min(diff / 40, 1),
      recText: `${Math.round(rec.tempo)}`,
      seedText: `${Math.round(seed.tempo)}`,
      unit: "BPM",
    });
  }

  if (seed.loudness != null && rec.loudness != null) {
    const diff = Math.abs(seed.loudness - rec.loudness);
    items.push({
      key: "loudness",
      label: "Volume",
      kind: "bar",
      seed: loudnessToUnit(seed.loudness),
      rec: loudnessToUnit(rec.loudness),
      closeness: 1 - Math.min(diff / 12, 1),
      recText: rec.loudness.toFixed(1).replace(".", ","),
      seedText: seed.loudness.toFixed(1).replace(".", ","),
      unit: "dB",
    });
  }

  // O gênero pesa 1,2 no vetor do modelo: quando é o mesmo, é o fator mais forte.
  if (seed.track_genre && seed.track_genre === rec.track_genre) {
    items.push({
      key: "genre",
      label: "Mesmo gênero",
      kind: "tag",
      closeness: 1.01,
      recText: seed.track_genre,
    });
  }

  return items.sort((x, y) => y.closeness - x.closeness).slice(0, count);
}

export const PICK_COPY = {
  similar: {
    label: "Muito parecida",
    long: "Está entre as mais parecidas com a música de partida.",
  },
  diverse: {
    label: "Para variar",
    long: "Ficou fora das mais parecidas, mas o MMR a escolheu para a playlist não ficar repetitiva.",
  },
};
