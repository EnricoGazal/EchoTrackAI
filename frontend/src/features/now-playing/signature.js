// Forma de onda "assinatura" de cada música.
// O Spotify não entrega o áudio, então a onda é gerada de forma
// determinística: a semente é o track_id (a mesma música sempre tem a mesma
// onda) e o formato é modulado pelas características da faixa:
//   energy       → altura média
//   loudness     → compressão (músicas altas ficam mais "cheias" e uniformes)
//   danceability → pulso regular, como batidas
//   tempo        → distância entre os pulsos

const RESOLUTION = 160;

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

function signature(song) {
  const rand = mulberry32(hashString(song.track_id || song.track_name || "echo"));
  const energy = clamp(song.energy ?? 0.6, 0, 1);
  const loud = clamp(((song.loudness ?? -8) + 20) / 18, 0, 1);
  const dance = clamp(song.danceability ?? 0.5, 0, 1);
  const tempo = clamp(song.tempo || 110, 60, 200);

  // Seções (intro, versos, refrões, ponte, final) com níveis diferentes.
  const sections = 5 + Math.floor(rand() * 3);
  const cuts = [0];
  for (let i = 1; i < sections; i += 1) cuts.push(i / sections + (rand() - 0.5) * 0.08);
  cuts.push(1);
  const levels = cuts.map((_, i) => {
    if (i === 0) return 0.35 + rand() * 0.15; // intro
    const chorus = i % 2 === 0;
    return chorus ? 0.8 + rand() * 0.2 : 0.5 + rand() * 0.25;
  });

  const period = Math.round(clamp(14 - tempo / 16, 3, 9));
  const phase = Math.floor(rand() * period);
  const out = new Array(RESOLUTION);

  for (let i = 0; i < RESOLUTION; i += 1) {
    const t = i / (RESOLUTION - 1);
    let s = 0;
    while (s < cuts.length - 2 && t > cuts[s + 1]) s += 1;
    const local = clamp((t - cuts[s]) / (cuts[s + 1] - cuts[s] || 1), 0, 1);
    const base = levels[s] + (levels[s + 1] - levels[s]) * ease(clamp((local - 0.8) / 0.2, 0, 1));

    const beat = (i + phase) % period === 0 ? 1 : (i + phase) % 2 === 0 ? 0.25 : -0.2;
    const pulse = beat * dance * 0.22;
    const noise = (rand() - 0.5) * (0.42 - loud * 0.2);

    let v = base * (0.5 + 0.5 * energy) + pulse + noise;
    v = clamp(v, 0.08, 1) ** (1 - 0.45 * loud);

    const fadeIn = clamp(i / 4, 0.25, 1);
    const fadeOut = clamp((RESOLUTION - 1 - i) / 6, 0.2, 1);
    out[i] = clamp(v * fadeIn * fadeOut, 0.08, 1);
  }
  return out;
}

const cache = new Map();

/** Alturas (0–1) para `count` barras. */
export function waveformFor(song, count) {
  const key = `${song.track_id}:${count}`;
  if (cache.has(key)) return cache.get(key);
  const sig = signature(song);
  const bars = Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i / count) * RESOLUTION);
    const to = Math.max(from + 1, Math.floor(((i + 1) / count) * RESOLUTION));
    let sum = 0;
    for (let j = from; j < to; j += 1) sum += sig[j];
    return sum / (to - from);
  });
  if (cache.size > 200) cache.clear();
  cache.set(key, bars);
  return bars;
}
