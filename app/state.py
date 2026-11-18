
from pathlib import Path

import numpy as np

from src.persistence import load_artifacts
from src.recommender import normalize_text, base_title, normalize_rows
from src.genres import group_of


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"


class AppState:
    def __init__(self):
        self.X = None
        self.scaler = None
        self.feature_columns = None
        self.df_clean = None
        self.metadata = None

        self.search_names = None
        self.search_artists = None
        self.artist_sets = None
        self.base_titles = None
        self.id_to_index = None
        self.genre_profiles = None
        self.artist_songs = None
        self.artist_names = None
        self.artist_search = None
        self.artist_vectors = None
        self.artist_row = None

        self.loaded = False

    def load(self):
        if self.loaded:
            return

        artifacts = load_artifacts(MODELS_DIR)

        self.X = artifacts["X"]
        self.scaler = artifacts["scaler"]
        self.feature_columns = artifacts["feature_columns"]
        self.df_clean = artifacts["df_clean"]
        self.metadata = artifacts["metadata"]

        # Normaliza os textos apenas uma vez.
        self.search_names = (
            self.df_clean["track_name"]
            .fillna("")
            .apply(normalize_text)
        )

        self.search_artists = (
            self.df_clean["artists"]
            .fillna("")
            .apply(normalize_text)
        )

        # Conjuntos de artistas, para reconhecer versões da mesma música.
        self.artist_sets = [
            frozenset(a.strip() for a in str(x).split(";") if a.strip())
            for x in self.df_clean["artists"]
        ]

        self.base_titles = (
            self.df_clean["track_name"].fillna("").map(base_title).to_numpy()
        )

        # Busca direta pelo track_id, sem passar pelo nome.
        self.id_to_index = {
            str(track_id): i
            for i, track_id in enumerate(self.df_clean["track_id"])
        }

        # Gênero principal de cada música (ex.: punk-rock -> rock).
        self.df_clean["genre_group"] = self.df_clean["track_genre"].map(group_of)

        # Perfil médio de cada gênero principal (média dos vetores das músicas).
        self.genre_profiles = {
            group: self.X[idx].mean(axis=0)
            for group, idx in self.df_clean.groupby("genre_group").indices.items()
        }

        # Músicas de cada artista (uma música pode ter vários artistas).
        artist_songs = {}
        for i, names in enumerate(self.artist_sets):
            for name in names:
                artist_songs.setdefault(name, []).append(i)
        self.artist_songs = {name: np.array(idx) for name, idx in artist_songs.items()}
        self.artist_names = list(self.artist_songs)
        self.artist_search = [normalize_text(n) for n in self.artist_names]

        # Perfil sonoro médio dos artistas com pelo menos 3 músicas,
        # usado em "Fãs também curtem".
        with_profile = [n for n in self.artist_names if len(self.artist_songs[n]) >= 3]
        vectors = np.stack([self.X[self.artist_songs[n]].mean(axis=0) for n in with_profile])
        self.artist_vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True).clip(1e-9)
        self.artist_row = {n: i for i, n in enumerate(with_profile)}
        self.artist_profile_names = with_profile

        # Média e desvio de cada característica, para o perfil musical.
        feats = ["energy", "valence", "danceability", "acousticness"]
        self.catalog_means = {f: float(self.df_clean[f].mean()) for f in feats}
        self.catalog_stds = {f: float(self.df_clean[f].std()) for f in feats}

        # Artistas mais populares de cada gênero principal (questionário).
        pop = self.df_clean["popularity"].to_numpy()
        groups = self.df_clean["genre_group"].to_numpy()
        ranked = []
        for name, idx in self.artist_songs.items():
            if len(idx) < 3:
                continue
            values, counts = np.unique(groups[idx], return_counts=True)
            ranked.append((int(pop[idx].max()), name, values[np.argmax(counts)]))
        ranked.sort(reverse=True)
        self.top_artists_by_group = {}
        for _, name, group in ranked:
            lst = self.top_artists_by_group.setdefault(group, [])
            if len(lst) < 24:
                lst.append(name)

        # Núcleo rápido: matriz normalizada uma vez só, popularidade em 0–1 e
        # onde ficam as colunas que o "rádio dirigível" empurra.
        self.Xn = normalize_rows(self.X)
        self.popularity = (self.df_clean["popularity"].to_numpy() / 100.0).astype(np.float32)
        self.genre_groups = self.df_clean["genre_group"].to_numpy()
        # O recomendador reaproveita a matriz já normalizada (sem custo no 1º pedido).
        from src.recommender import _XN_CACHE
        _XN_CACHE[id(self.X)] = self.Xn
        self.steer_columns = {
            f: self.feature_columns.index(f)
            for f in ("energy", "acousticness", "valence", "danceability")
            if f in self.feature_columns
        }
        self.raw_stds = {
            f: float(self.df_clean[f].std())
            for f in ("energy", "acousticness", "valence", "danceability")
        }

        self.loaded = True

        print(
            f"Modelo carregado: {len(self.df_clean)} músicas"
        )

        print(
            f"Gêneros: {self.df_clean['genre_group'].nunique()} principais "
            f"({self.df_clean['track_genre'].nunique()} subgêneros)"
        )

        print(
            f"Características: {self.X.shape[1]}"
        )

        print(
            f"Artistas: {len(self.artist_names)}"
        )


state = AppState()
