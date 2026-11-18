// Lugar reservado para o player oficial do Spotify na tela "Tocando agora".
// O player é sempre o mesmo elemento (fixo na tela); quando a tela cheia
// está aberta, ele acompanha a posição deste espaço reservado.
let slot = null;
export const setEmbedSlot = (el) => {
  slot = el;
};
export const getEmbedSlot = () => slot;
