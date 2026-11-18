import { cleanTitle } from "../../utils";

/*
 * De onde veio cada recomendação — o que a interface mostra como
 * "Porque você escolheu X", "Porque você curte Y", "Na ponte entre A e B"...
 *
 * listOrigin descreve a lista que está tocando:
 *   { kind: "seed",    seed }            playlist a partir de uma música
 *   { kind: "radio",   seed }            continuação automática (modo rádio)
 *   { kind: "genre",   profile, label }  playlist a partir de um gênero
 *   { kind: "profile", title }           "Feito para você"
 *   { kind: "bridge",  from, to }        ponte entre duas músicas
 *   { kind: "manual",  name }            lista sem IA (artista, biblioteca)
 */
export function originFor(song, listOrigin) {
  if (!listOrigin || listOrigin.kind === "manual" || !song) return null;
  const isRec = song.similarity != null || song.because || song.t != null;
  if (!isRec) return null;
  switch (listOrigin.kind) {
    case "seed":
      return { text: "Porque você escolheu", strong: cleanTitle(listOrigin.seed.track_name), seed: listOrigin.seed };
    case "radio":
      return { text: "Rádio a partir de", strong: cleanTitle(listOrigin.seed.track_name), seed: listOrigin.seed };
    case "genre":
      return { text: "Do som médio de", strong: listOrigin.label, seed: listOrigin.profile ? { ...listOrigin.profile, track_name: listOrigin.label } : null };
    case "profile": {
      const m = /^(Porque você (?:curte|escolheu)) (.+)$/.exec(song.because || "");
      return m
        ? { text: m[1], strong: m[2], seed: null }
        : { text: "Do seu perfil", strong: listOrigin.title || "musical", seed: null };
    }
    case "bridge":
      return {
        text: "Na ponte entre",
        strong: `${cleanTitle(listOrigin.from.track_name)} → ${cleanTitle(listOrigin.to.track_name)}`,
        seed: null,
      };
    default:
      return null;
  }
}

export const listName = (listOrigin) => {
  if (!listOrigin) return "";
  switch (listOrigin.kind) {
    case "seed":
    case "radio":
      return cleanTitle(listOrigin.seed.track_name);
    case "genre":
      return listOrigin.label;
    case "profile":
      return "Feito para você";
    case "bridge":
      return `Ponte: ${cleanTitle(listOrigin.from.track_name)} → ${cleanTitle(listOrigin.to.track_name)}`;
    default:
      return listOrigin.name || "";
  }
};
