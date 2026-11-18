import { useEffect, useState } from "react";
import { coverUrl } from "../../api";

// Cor ambiente do Now Playing. Tenta tirar a média da capa; se o navegador
// não deixar ler a imagem (ou não houver capa), deriva da própria música
// (alegria → matiz, energia → saturação). A luminosidade é fixa e baixa para
// o texto por cima manter o contraste.
function fromFeatures(song) {
  const hue = Math.round(250 + (song.valence ?? 0.5) * 160) % 360; // triste = azul, alegre = laranja
  const chroma = (0.05 + (song.energy ?? 0.5) * 0.08).toFixed(3);
  // Mesma luminosidade de uma superfície clara do tema; só matiz e croma vêm da música.
  return `oklch(from var(--surface-3) calc(l + 0.14) ${chroma} ${hue})`;
}

function fromImage(id) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 8;
        c.height = 8;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
        }
        const n = d.length / 4;
        // Mistura com o fundo para ficar escura e sempre legível.
        resolve(`color-mix(in oklch, rgb(${r / n | 0} ${g / n | 0} ${b / n | 0}) 70%, var(--surface-3))`);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = coverUrl(id);
  });
}

export function useAmbient(song) {
  const [color, setColor] = useState(() => (song ? fromFeatures(song) : undefined));
  useEffect(() => {
    if (!song) return undefined;
    let alive = true;
    setColor(fromFeatures(song));
    fromImage(song.track_id)
      .then((c) => alive && setColor(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [song?.track_id]); // eslint-disable-line react-hooks/exhaustive-deps
  return color;
}
