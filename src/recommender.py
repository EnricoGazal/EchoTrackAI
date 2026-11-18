

import numpy as np
import pandas as pd

import re
import unicodedata

from difflib import get_close_matches, SequenceMatcher
from sklearn.metrics.pairwise import cosine_similarity


RESULT_COLS = [
    "track_id",
    "track_name",
    "artists",
    "album_name",
    "track_genre",
    "popularity",
    "similarity"
]


def normalize_text(text):
    """
    Normaliza textos:
    - Converte para minúsculas.
    - Remove acentos.
    - Remove caracteres especiais.
    - Remove espaços extras.
    """

    text = str(text).strip().lower()

    text = unicodedata.normalize("NFKD", text)

    text = "".join(
        char for char in text
        if not unicodedata.combining(char)
    )

    text = re.sub(r"[^a-z0-9]+", " ", text)

    return " ".join(text.split())


def find_song_index(df, track_name, artist_hint=None):
    """
    Localiza uma música priorizando o título.

    Ordem de busca:
    1. Nome exato.
    2. Nome parcial.
    3. Nome aproximado (erro de digitação).

    O artista é utilizado apenas como critério complementar.
    Um artista incorreto nunca elimina uma música encontrada.
    """

    query = normalize_text(track_name)

    if not query or "track_name" not in df.columns:
        return None

    names = (
        df["track_name"]
        .fillna("")
        .apply(normalize_text)
    )

    # Artista é um critério complementar.
    artist_query = normalize_text(artist_hint) if artist_hint else ""

    if artist_query and "artists" in df.columns:
        artists = (
            df["artists"]
            .fillna("")
            .apply(normalize_text)
        )

        artist_matches = artists.apply(
            lambda artist: artist_query in artist
        )
    else:
        artist_matches = pd.Series(
            False,
            index=df.index
        )

    # Remove títulos vazios.
    valid_names = names[names != ""]

    # Guarda os títulos únicos para evitar buscas repetidas.
    unique_names = valid_names.unique().tolist()

    if not unique_names:
        return None

    candidates = []

    # --------------------------------------------------
    # 1. BUSCA EXATA
    # --------------------------------------------------

    exact_matches = names == query

    if exact_matches.any():

        for position in np.flatnonzero(exact_matches.to_numpy()):

            candidates.append((
                3,
                1.0,
                bool(artist_matches.iloc[position]),
                position
            ))

    # --------------------------------------------------
    # 2. BUSCA PARCIAL
    # --------------------------------------------------

    else:

        partial_matches = names.str.contains(
            re.escape(query),
            regex=True,
            na=False
        )

        if partial_matches.any():

            for position in np.flatnonzero(
                partial_matches.to_numpy()
            ):

                title = names.iloc[position]

                # Quanto mais próximo do título completo,
                # maior a pontuação.
                title_score = len(query) / max(len(title), 1)

                candidates.append((
                    2,
                    title_score,
                    bool(artist_matches.iloc[position]),
                    position
                ))

    # --------------------------------------------------
    # 3. BUSCA APROXIMADA
    # --------------------------------------------------

    if not candidates and len(query) >= 4:

        similar_names = get_close_matches(
            query,
            unique_names,
            n=10,
            cutoff=0.65
        )

        for similar_name in similar_names:

            similarity = SequenceMatcher(
                None,
                query,
                similar_name
            ).ratio()

            matching_positions = np.flatnonzero(
                (names == similar_name).to_numpy()
            )

            for position in matching_positions:

                candidates.append((
                    1,
                    similarity,
                    bool(artist_matches.iloc[position]),
                    position
                ))

    # --------------------------------------------------
    # 4. ESCOLHA DO MELHOR RESULTADO
    # --------------------------------------------------

    if not candidates:
        return None

    # Primeiro prioriza a qualidade da correspondência
    # do título; depois utiliza o artista como desempate.
    best_candidate = max(
        candidates,
        key=lambda candidate: (
            candidate[0],
            candidate[1],
            candidate[2]
        )
    )

    return best_candidate[3]


def recommend_songs(track_name, df, X, artist_hint=None, n=10):

    idx = find_song_index(
        df,
        track_name,
        artist_hint
    )

    if idx is None:
        return None

    similarities = cosine_similarity(
        X[idx].reshape(1, -1),
        X
    )[0]

    recommended_indices = np.argsort(-similarities)

    recommended_indices = recommended_indices[
        recommended_indices != idx
    ][:n]

    result = df.iloc[recommended_indices].copy()

    result["similarity"] = similarities[recommended_indices]

    available_cols = [
        col for col in RESULT_COLS
        if col in result.columns
    ]

    return result[available_cols].reset_index(drop=True)


def recommend_songs_mmr(
    track_name,
    df,
    X,
    artist_hint=None,
    n=10,
    lam=0.75,
    pool_size=100
):

    idx = find_song_index(
        df,
        track_name,
        artist_hint
    )

    if idx is None:
        return None

    similarities = cosine_similarity(
        X[idx].reshape(1, -1),
        X
    )[0]

    candidates = np.argsort(-similarities)

    candidates = candidates[
        candidates != idx
    ][:pool_size]

    relevance = similarities[candidates]

    similarity_matrix = cosine_similarity(
        X[candidates]
    )

    selected = []
    remaining = list(range(len(candidates)))

    while len(selected) < n and remaining:

        if not selected:

            best = max(
                remaining,
                key=lambda p: relevance[p]
            )

        else:

            best = max(
                remaining,
                key=lambda p: (
                    lam * relevance[p]
                    - (1 - lam) * max(
                        similarity_matrix[p, s]
                        for s in selected
                    )
                )
            )

        selected.append(best)
        remaining.remove(best)

    selected_indices = candidates[selected]

    result = df.iloc[selected_indices].copy()

    result["similarity"] = relevance[selected]

    available_cols = [
        col for col in RESULT_COLS
        if col in result.columns
    ]

    return result[available_cols].reset_index(drop=True)


# ======================================================================
# Recomendação por índice ou por vetor (usada pela API)
# ======================================================================

def _is_same_song(title_a, artists_a, title_b, artists_b):
    """Duas faixas são a mesma música quando têm o mesmo título
    normalizado e pelo menos um artista em comum (ex.: versão ao vivo
    ou remasterizada já removida pela normalização, outro álbum)."""
    return title_a == title_b and bool(artists_a & artists_b)


def _unique_candidates(order, titles, artist_sets, size, seed=None):
    """Percorre o ranking e descarta outras versões da música de partida
    e versões repetidas entre si, até juntar `size` candidatos."""
    kept = []
    seen = []
    for i in order:
        if seed is not None and (
            i == seed
            or _is_same_song(titles[i], artist_sets[i], titles[seed], artist_sets[seed])
        ):
            continue
        if any(_is_same_song(titles[i], artist_sets[i], t, a) for t, a in seen):
            continue
        kept.append(i)
        seen.append((titles[i], artist_sets[i]))
        if len(kept) == size:
            break
    return np.array(kept)


_XN_CACHE = {}


def recommend_from_vector(
    vector,
    df,
    X,
    titles,
    artist_sets,
    n=10,
    method="mmr",
    seed_index=None,
    lam=0.75,
    pool_size=100,
    popularity=None,
    obscurity=0.0,
):
    """Recomenda a partir de um vetor qualquer: o vetor de uma música
    (seed_index informado), o perfil médio de um gênero ou um vetor
    "dirigido". Usa o núcleo rápido (matriz normalizada guardada)."""
    key = id(X)
    if key not in _XN_CACHE:
        _XN_CACHE.clear()
        _XN_CACHE[key] = normalize_rows(X)
    selected, sims, roles = fast_recommend(
        vector, _XN_CACHE[key], titles, artist_sets,
        n=n, method=method, seed_index=seed_index, lam=lam,
        pool_size=pool_size, popularity=popularity, obscurity=obscurity,
    )
    result = df.iloc[selected].copy()
    result["similarity"] = sims
    result["pick"] = roles
    return result.reset_index(drop=True)


def base_title(text):
    """Título sem marcações de versão, para reconhecer a mesma música:
    "High Hopes - Live" e "High Hopes (2011 Remaster)" viram "high hopes"."""
    text = str(text).split(" - ")[0]
    text = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", text)
    return normalize_text(text)


# ---------------------------------------------------------------------------
# Núcleo rápido (usado pela API)
# ---------------------------------------------------------------------------
# A matriz de características já chega normalizada (cada linha com norma 1),
# então a similaridade do cosseno vira um único produto de matrizes. Isso
# evita normalizar as 89 mil músicas a cada pedido. O modelo é o mesmo.


def normalize_rows(X):
    """Normaliza cada linha para norma 1 (float32, para o produto ficar rápido)."""
    X = np.asarray(X, dtype=np.float32)
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    return X / np.clip(norms, 1e-9, None)


def _unit(vector):
    v = np.asarray(vector, dtype=np.float32)
    return v / max(float(np.linalg.norm(v)), 1e-9)


def mmr_select(Xn, candidates, relevance, n, lam):
    """MMR vetorizado: a cada passo escolhe o que equilibra relevância e
    diferença em relação aos já escolhidos (λ = peso da relevância)."""
    if len(candidates) == 0:
        return np.array([], dtype=int)
    pair = Xn[candidates] @ Xn[candidates].T
    chosen = [int(np.argmax(relevance))]
    max_sim = pair[chosen[0]].copy()
    available = np.ones(len(candidates), dtype=bool)
    available[chosen[0]] = False
    while len(chosen) < min(n, len(candidates)):
        score = lam * relevance - (1 - lam) * max_sim
        score[~available] = -np.inf
        best = int(np.argmax(score))
        chosen.append(best)
        available[best] = False
        np.maximum(max_sim, pair[best], out=max_sim)
    return np.asarray(chosen)


def fast_recommend(
    vector,
    Xn,
    titles,
    artist_sets,
    n=10,
    method="mmr",
    seed_index=None,
    lam=0.75,
    pool_size=100,
    popularity=None,
    obscurity=0.0,
):
    """Recomenda a partir de um vetor (música, gênero, perfil ou vetor
    "dirigido"). Devolve índices, similaridade real e o papel no MMR.

    obscurity > 0 ativa o modo "fora da bolha": dentro das músicas de som
    mais próximo, as menos populares sobem no ranking.
    """
    sims = Xn @ _unit(vector)

    # Folga de candidatos para compensar versões repetidas descartadas.
    wide = pool_size * (12 if obscurity > 0 else 3)
    order = np.argpartition(-sims, wide)[:wide]

    score = sims[order]
    if obscurity > 0 and popularity is not None:
        score = score - obscurity * popularity[order]
    order = order[np.argsort(-score)]

    size = n if method == "baseline" else max(pool_size, n)
    candidates = _unique_candidates(order, titles, artist_sets, size, seed_index)
    if len(candidates) == 0:
        return np.array([], dtype=int), np.array([]), []

    relevance = sims[candidates]
    if obscurity > 0 and popularity is not None:
        relevance = relevance - obscurity * popularity[candidates]

    if method == "baseline":
        picked = np.arange(min(n, len(candidates)))
    else:
        picked = mmr_select(Xn, candidates, relevance, n, lam)

    selected = candidates[picked]
    roles = ["similar" if p < n else "diverse" for p in picked]
    return selected, sims[selected], roles


def bridge_path(Xn, start, end, titles, artist_sets, n=12, popularity=None, obscurity=0.0, allowed=None):
    """Ponte entre duas músicas: n paradas ao longo da linha reta entre os
    dois vetores. Em cada ponto do caminho entra a música mais próxima que
    ainda não está na lista (sem repetir artista em sequência).
    `allowed` limita a busca (ex.: aos estilos das duas pontas), o que
    também deixa o cálculo bem mais rápido."""
    a, b = Xn[start], Xn[end]
    steps = np.linspace(0.0, 1.0, n)[1:-1]
    targets = np.stack([(1 - t) * a + t * b for t in steps]).astype(np.float32)
    targets /= np.linalg.norm(targets, axis=1, keepdims=True).clip(1e-9)

    pool = np.flatnonzero(allowed) if allowed is not None else np.arange(len(Xn))
    sims = targets @ Xn[pool].T  # (paradas x candidatas) num único produto
    if obscurity > 0 and popularity is not None:
        sims = sims - obscurity * popularity[pool][None, :]

    k = min(80, sims.shape[1] - 1)
    used = [start, end]
    picks = []
    prev_artists = artist_sets[start]
    for row in sims:
        top = np.argpartition(-row, k)[:k]
        top = pool[top[np.argsort(-row[top])]]
        pick = None
        for i in top:
            if any(_is_same_song(titles[i], artist_sets[i], titles[u], artist_sets[u]) for u in used):
                continue
            if artist_sets[i] & prev_artists:
                continue
            pick = int(i)
            break
        if pick is None:
            pick = int(top[0])
        used.append(pick)
        prev_artists = artist_sets[pick]
        picks.append(pick)

    # Ordena pelo quanto cada música já "chegou" no destino, para a
    # transição ser sempre para a frente.
    progress = [float(Xn[i] @ b - Xn[i] @ a) for i in picks]
    ordered = [picks[j] for j in np.argsort(progress)]
    return list(zip(ordered, steps.tolist()))
