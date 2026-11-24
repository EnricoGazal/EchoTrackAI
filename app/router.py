
import asyncio
import re
import time
from collections import OrderedDict
from typing import Optional

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse, Response

from app.state import state
from app.schemas import (
    ArtistOut,
    ArtistResponse,
    SongOut,
    SearchResponse,
    RecommendResponse,
    RecommendationOut,
    BridgeResponse,
    BridgeStep,
    GenresResponse,
    GenreItem,
    GenreProfile,
    GenreRecommendResponse,
    HealthResponse,
)

from src.recommender import normalize_text, recommend_from_vector, bridge_path
from src.genres import GENRE_GROUPS, GROUPS_BY_ID, group_label


router = APIRouter()

# Capas dos álbuns: vêm do oEmbed público do Spotify, que não exige chave
# de API. O resultado fica em memória para não repetir a consulta.
OEMBED_URL = "https://open.spotify.com/oembed"
_cover_cache: dict = {}
_cover_limit = None
_http = None


def _cover_client():
    """Cria o cliente HTTP na primeira chamada, já dentro do servidor."""
    global _cover_limit, _http
    if _http is None:
        _cover_limit = asyncio.Semaphore(8)
        _http = httpx.AsyncClient(
            timeout=8.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (EchoTrack)"},
        )
    return _cover_limit, _http


# As imagens das capas também ficam guardadas (as mais recentes), para o site
# receber a capa do próprio servidor, sem depender de o navegador conseguir
# abrir o endereço do Spotify (bloqueios de privacidade, CDN, etc.).
_image_cache: "OrderedDict[str, tuple]" = OrderedDict()
_IMAGE_CACHE_SIZE = 600


def _cdn_candidates(url: str) -> list:
    """Endereços para tentar baixar a capa: o original e o da CDN clássica
    do Spotify (i.scdn.co), que aceita o mesmo identificador de imagem."""
    urls = [url]
    m = re.search(r"/image/([0-9a-fA-F]{20,})", url)
    if m:
        classic = f"https://i.scdn.co/image/{m.group(1)}"
        if classic != url:
            urls.append(classic)
    return urls


def _image_type(content: bytes, header: str):
    """Tipo da imagem pelo cabeçalho ou, se faltar, pelos primeiros bytes."""
    if header.startswith("image/"):
        return header.split(";")[0]
    if content[:2] == b"\xff\xd8":
        return "image/jpeg"
    if content[:4] == b"\x89PNG":
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


async def _download_image(url: str):
    limit, http = _cover_client()
    for candidate in _cdn_candidates(url):
        try:
            async with limit:
                r = await http.get(candidate)
            media_type = _image_type(r.content, r.headers.get("content-type", ""))
            if r.status_code == 200 and media_type:
                return r.content, media_type
        except httpx.HTTPError as exc:
            print(f"Falha ao baixar capa {candidate}: {exc!r}")
    return None

METHOD_PATTERN = "^(mmr|baseline)$"

FEATURES = [
    "danceability",
    "energy",
    "valence",
    "acousticness",
    "instrumentalness",
    "tempo",
]

# Enviadas por faixa (além das de cima), para a interface explicar e
# desenhar a música; não entram nas médias dos gêneros.
EXTRA_FEATURES = ["loudness", "speechiness", "liveness"]


def to_song_out(row):
    album = row.get("album_name")

    return SongOut(
        track_id=str(row.get("track_id", "")),
        track_name=str(row.get("track_name", "")),
        artists=str(row.get("artists", "")),
        track_genre=str(row.get("track_genre", "")),
        genre_group=group_label(row.get("genre_group", "")),
        album_name=str(album) if album is not None else None,
        popularity=int(row.get("popularity", 0)),
        duration_ms=int(row.get("duration_ms", 0)),
        explicit=bool(row.get("explicit", False)),
        **{f: float(row.get(f, 0.0)) for f in FEATURES + EXTRA_FEATURES},
    )


def to_recommendations(df):
    return [
        RecommendationOut(
            **to_song_out(row).model_dump(),
            similarity=float(row["similarity"]),
            pick=str(row.get("pick", "similar")),
            because=row.get("because") if isinstance(row.get("because"), str) else None,
        )
        for _, row in df.iterrows()
    ]


# Respostas recentes ficam guardadas: voltar a uma posição dos controles
# do rádio (ou repetir uma ponte) responde na hora, sem recalcular.
_CACHE: "OrderedDict[tuple, object]" = OrderedDict()
_CACHE_SIZE = 512


def cached(key, build):
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return _CACHE[key]
    value = build()
    _CACHE[key] = value
    if len(_CACHE) > _CACHE_SIZE:
        _CACHE.popitem(last=False)
    return value


# Rádio dirigível: cada controle (-1 a 1) empurra a coluna padronizada da
# característica em até 1,5 desvio-padrão. O modelo não muda; muda o ponto
# de partida da busca.
STEER_Z = 1.5
STEERABLE = ("energy", "acousticness", "valence")
OBSCURITY = 0.06  # peso da popularidade no modo "fora da bolha"


def steered_vector(base, steer):
    v = np.array(base, dtype=np.float32, copy=True)
    for feature, amount in steer.items():
        col = state.steer_columns.get(feature)
        if col is not None and amount:
            v[col] += amount * STEER_Z
    return v


def steer_target(song_row, steer):
    """Valor aproximado (0–1) que a busca passa a mirar em cada característica."""
    return {
        f: float(np.clip(float(song_row[f]) + steer.get(f, 0.0) * STEER_Z * state.raw_stds[f], 0, 1))
        for f in STEERABLE
    }


def artist_out(name):
    """Resumo de um artista: a foto é a capa da sua música mais popular."""
    idx = state.artist_songs[name]
    all_popularity = state.df_clean["popularity"].to_numpy()
    popularity = all_popularity[idx]

    # A foto é a capa da música mais popular em que ele é o artista principal.
    main = [i for i in idx if state.df_clean["artists"].iat[i].split(";")[0].strip() == name]
    pool = np.array(main) if main else idx
    top = pool[int(np.argmax(all_popularity[pool]))]
    return ArtistOut(
        name=name,
        # Conta músicas diferentes (a mesma música em vários álbuns conta uma vez).
        n_songs=len(set(state.base_titles[idx])),
        image_track_id=str(state.df_clean["track_id"].iat[top]),
        popularity=int(popularity.max()),
    )


def find_artists(query, limit=3):
    """Artistas cujo nome contém o texto; o nome exato vem primeiro."""
    matches = [
        name
        for name, norm in zip(state.artist_names, state.artist_search)
        if query in norm
    ]
    popularity = state.df_clean["popularity"].to_numpy()
    matches.sort(
        key=lambda n: (
            normalize_text(n) != query,
            -int(popularity[state.artist_songs[n]].max()),
        )
    )
    return [artist_out(n) for n in matches[:limit]]


@router.get("/health", response_model=HealthResponse)
def health():

    if not state.loaded:
        return HealthResponse(status="not_loaded")

    return HealthResponse(
        status="ok",
        n_songs=len(state.df_clean),
        n_genres=state.df_clean["genre_group"].nunique(),
        default_recommender=state.metadata.get(
            "default_recommender", "mmr"
        ),
    )


@router.get("/search", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
):
    query = normalize_text(q)

    if not query:
        return SearchResponse(query=q, results=[])

    df = state.df_clean

    # A busca considera título e artista.
    title_matches = state.search_names.str.contains(
        re.escape(query), regex=True, na=False
    )
    artist_matches = state.search_artists.str.contains(
        re.escape(query), regex=True, na=False
    )

    # Ordena por popularidade ANTES de limitar, para que as faixas
    # mais conhecidas apareçam primeiro.
    results = (
        df[title_matches | artist_matches]
        .sort_values("popularity", ascending=False)
        .head(limit)
    )

    return SearchResponse(
        query=q,
        results=[to_song_out(row) for _, row in results.iterrows()],
        artists=find_artists(query),
    )


@router.get("/recommend/genre/{genre}", response_model=GenreRecommendResponse)
def recommend_genre(
    genre: str,
    n: int = Query(10, ge=1, le=50),
    method: str = Query("mmr", pattern=METHOD_PATTERN),
    lam: float = Query(0.75, ge=0.0, le=1.0),
    obscure: bool = False,
):
    """Playlist a partir do perfil sonoro médio de um gênero principal (RF05).
    `genre` é o id do gênero principal, como "rock" ou "funk"."""
    if genre not in state.genre_profiles:
        raise HTTPException(status_code=404, detail="Gênero não encontrado.")

    started = time.perf_counter()
    df = state.df_clean
    songs = df[df["genre_group"] == genre]

    recommendations = recommend_from_vector(
        state.genre_profiles[genre],
        df,
        state.X,
        state.base_titles,
        state.artist_sets,
        n=n,
        method=method,
        lam=lam,
        popularity=state.popularity,
        obscurity=OBSCURITY if obscure else 0.0,
    )

    profile = GenreProfile(
        genre=genre,
        label=group_label(genre),
        subgenres=GROUPS_BY_ID.get(genre, {}).get("genres", []),
        n_songs=len(songs),
        **{f: float(songs[f].mean()) for f in FEATURES},
    )

    return GenreRecommendResponse(
        profile=profile,
        recommender=method,
        recommendations=to_recommendations(recommendations),
        elapsed_ms=round((time.perf_counter() - started) * 1000, 1),
    )


@router.get("/recommend/{track_id}", response_model=RecommendResponse)
def recommend(
    track_id: str,
    n: int = Query(10, ge=1, le=50),
    method: str = Query("mmr", pattern=METHOD_PATTERN),
    lam: float = Query(0.75, ge=0.0, le=1.0),
    energy: float = Query(0.0, ge=-1.0, le=1.0),
    acousticness: float = Query(0.0, ge=-1.0, le=1.0),
    valence: float = Query(0.0, ge=-1.0, le=1.0),
    obscure: bool = False,
):
    """Playlist a partir de uma música. Os parâmetros extras formam o
    "rádio dirigível": energy/acousticness/valence puxam a busca para mais
    (ou menos) daquela característica, lam ajusta o MMR (1 = só parecidas,
    0 = máxima variedade) e obscure ativa o modo "fora da bolha"."""
    started = time.perf_counter()
    idx = state.id_to_index.get(track_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Música não encontrada no dataset.")

    steer = {
        f: round(v, 2)
        for f, v in (("energy", energy), ("acousticness", acousticness), ("valence", valence))
        if abs(v) >= 0.01
    }
    key = ("song", track_id, n, method, round(lam, 2), tuple(sorted(steer.items())), obscure)

    def build():
        df = state.df_clean
        recs = recommend_from_vector(
            steered_vector(state.X[idx], steer),
            df,
            state.X,
            state.base_titles,
            state.artist_sets,
            n=n,
            method=method,
            seed_index=idx,
            lam=lam,
            popularity=state.popularity,
            obscurity=OBSCURITY if obscure else 0.0,
        )
        seed_row = df.iloc[idx]
        return RecommendResponse(
            seed=to_song_out(seed_row),
            recommender=method,
            recommendations=to_recommendations(recs),
            steer=steer,
            target=steer_target(seed_row, steer),
            lam=lam,
            obscure=obscure,
        )

    response = cached(key, build).model_copy()
    response.elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    return response


@router.get("/bridge", response_model=BridgeResponse)
def bridge(
    start: str = Query(..., alias="from"),
    end: str = Query(..., alias="to"),
    n: int = Query(12, ge=4, le=30),
    obscure: bool = False,
):
    """Ponte entre duas músicas: uma playlist que sai de uma e chega na
    outra mudando aos poucos (paradas ao longo da reta entre os vetores)."""
    started = time.perf_counter()
    ia = state.id_to_index.get(start)
    ib = state.id_to_index.get(end)
    if ia is None or ib is None:
        raise HTTPException(status_code=404, detail="Música não encontrada no dataset.")
    if ia == ib:
        raise HTTPException(status_code=400, detail="Escolha duas músicas diferentes.")

    def build():
        df = state.df_clean
        Xn = state.Xn
        groups = state.genre_groups
        allowed = (groups == groups[ia]) | (groups == groups[ib])
        path = bridge_path(
            Xn, ia, ib, state.base_titles, state.artist_sets, n=n,
            popularity=state.popularity, obscurity=OBSCURITY if obscure else 0.0,
            allowed=allowed,
        )
        a, b = Xn[ia], Xn[ib]
        steps = []
        for i, t in path:
            target = (1 - t) * a + t * b
            target = target / max(float(np.linalg.norm(target)), 1e-9)
            steps.append(
                BridgeStep(
                    **to_song_out(df.iloc[i]).model_dump(),
                    t=t,
                    similarity=float(Xn[i] @ target),
                    sim_from=float(Xn[i] @ a),
                    sim_to=float(Xn[i] @ b),
                )
            )
        return BridgeResponse(
            start=to_song_out(df.iloc[ia]),
            end=to_song_out(df.iloc[ib]),
            steps=steps,
            obscure=obscure,
        )

    response = cached(("bridge", ia, ib, n, obscure), build).model_copy()
    response.elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    return response


@router.get("/popular", response_model=SearchResponse)
def popular(limit: int = Query(12, ge=1, le=50)):
    """Músicas mais populares, uma por artista, para sugerir na tela inicial."""
    df = state.df_clean.sort_values("popularity", ascending=False)
    main_artist = df["artists"].str.split(";").str[0]
    df = df[~main_artist.duplicated()].head(limit)
    return SearchResponse(
        query="",
        results=[to_song_out(row) for _, row in df.iterrows()],
    )


async def _fetch_cover(track_id: str) -> Optional[str]:
    """Busca a URL da capa no oEmbed do Spotify.
    Levanta exceção em falha de rede, para não guardar o erro no cache."""
    limit, http = _cover_client()
    async with limit:
        response = await http.get(
            OEMBED_URL,
            params={"url": f"https://open.spotify.com/track/{track_id}"},
        )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json().get("thumbnail_url")


@router.get("/cover/{track_id}")
async def cover(track_id: str):
    """Capa do álbum no Spotify (300 x 300 px), entregue pelo próprio servidor.
    Responde 404 quando a faixa não tem capa ou o Spotify não respondeu;
    nesse caso a interface mostra um disco no lugar."""
    if track_id not in state.id_to_index:
        raise HTTPException(status_code=404, detail="Música não encontrada no dataset.")

    if track_id not in _cover_cache:
        try:
            _cover_cache[track_id] = await _fetch_cover(track_id)
        except (httpx.HTTPError, ValueError) as exc:
            print(f"Capa indisponível para {track_id}: {exc!r}")
            raise HTTPException(status_code=404, detail="Capa indisponível no momento.")

    url = _cover_cache[track_id]
    if not url:
        raise HTTPException(status_code=404, detail="Capa indisponível.")

    headers = {"Cache-Control": "public, max-age=604800"}
    if track_id in _image_cache:
        _image_cache.move_to_end(track_id)
        content, media_type = _image_cache[track_id]
        return Response(content, media_type=media_type, headers=headers)

    image = await _download_image(url)
    if image:
        _image_cache[track_id] = image
        if len(_image_cache) > _IMAGE_CACHE_SIZE:
            _image_cache.popitem(last=False)
        return Response(image[0], media_type=image[1], headers=headers)

    # Se o servidor não conseguiu baixar, o navegador tenta direto no Spotify.
    return RedirectResponse(
        url,
        status_code=307,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/artist", response_model=ArtistResponse)
def artist(name: str = Query(..., min_length=1)):
    """Perfil do artista: todas as músicas no catálogo, da mais popular para a
    menos popular, e artistas de som parecido ("Fãs também curtem")."""
    if name not in state.artist_songs:
        raise HTTPException(status_code=404, detail="Artista não encontrado.")

    df = state.df_clean
    idx = state.artist_songs[name]
    songs = df.iloc[idx].assign(_title=state.base_titles[idx])
    # Mesma música em vários álbuns aparece uma vez só (a versão mais popular).
    songs = (
        songs.sort_values("popularity", ascending=False)
        .drop_duplicates(subset="_title")
        .drop(columns="_title")
    )

    genres = [
        group_label(g)
        for g in songs["genre_group"].value_counts().index[:3]
    ]

    related = []
    row = state.artist_row.get(name)
    if row is not None:
        sims = state.artist_vectors @ state.artist_vectors[row]
        for j in np.argsort(-sims)[1:40]:
            other = state.artist_profile_names[j]
            if other != name:
                related.append(artist_out(other))
            if len(related) == 6:
                break

    return ArtistResponse(
        artist=artist_out(name),
        genres=genres,
        songs=[to_song_out(r) for _, r in songs.iterrows()],
        related=related,
    )


@router.get("/genres", response_model=GenresResponse)
def genres():
    """Gêneros principais com seus subgêneros, quantidade de músicas e popularidade média."""
    stats = (
        state.df_clean.groupby("genre_group")
        .agg(n_songs=("track_id", "size"), popularity=("popularity", "mean"))
    )

    # Mantém a ordem definida em src/genres.py (Rock, Metal, Pop...).
    return GenresResponse(
        genres=[g["id"] for g in GENRE_GROUPS],
        details=[
            GenreItem(
                genre=g["id"],
                label=g["label"],
                subgenres=g["genres"],
                n_songs=int(stats.loc[g["id"], "n_songs"]),
                popularity=float(stats.loc[g["id"], "popularity"]),
            )
            for g in GENRE_GROUPS
            if g["id"] in stats.index
        ],
    )
