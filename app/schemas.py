
from typing import Optional
from pydantic import BaseModel


class SongOut(BaseModel):
    track_id: str
    track_name: str
    artists: str
    track_genre: str
    genre_group: str = ""
    album_name: Optional[str] = None
    popularity: int = 0
    duration_ms: Optional[int] = None
    explicit: Optional[bool] = None
    danceability: Optional[float] = None
    energy: Optional[float] = None
    valence: Optional[float] = None
    acousticness: Optional[float] = None
    instrumentalness: Optional[float] = None
    tempo: Optional[float] = None
    loudness: Optional[float] = None
    speechiness: Optional[float] = None
    liveness: Optional[float] = None


class ArtistOut(BaseModel):
    name: str
    n_songs: int
    image_track_id: str
    popularity: int = 0


class SearchResponse(BaseModel):
    query: str
    results: list[SongOut]
    artists: list[ArtistOut] = []


class ArtistResponse(BaseModel):
    artist: ArtistOut
    genres: list[str]
    songs: list[SongOut]
    related: list[ArtistOut]


class RecommendationOut(SongOut):
    similarity: float
    # "similar": estaria entre as mais parecidas de qualquer jeito.
    # "diverse": o MMR a escolheu para variar a playlist (não estaria entre
    # as N mais parecidas pela similaridade pura).
    pick: str = "similar"
    # "Feito para você": de qual gosto do perfil a música veio.
    because: Optional[str] = None


class RecommendResponse(BaseModel):
    seed: SongOut
    recommender: str
    recommendations: list[RecommendationOut]
    # Rádio dirigível: o quanto cada característica foi empurrada (-1 a 1),
    # o valor-alvo resultante, o λ do MMR e se o modo "fora da bolha" está ativo.
    steer: dict = {}
    target: dict = {}
    lam: float = 0.75
    obscure: bool = False
    elapsed_ms: float = 0.0


class BridgeStep(SongOut):
    t: float
    similarity: float
    sim_from: float
    sim_to: float


class BridgeResponse(BaseModel):
    start: SongOut
    end: SongOut
    steps: list[BridgeStep]
    obscure: bool = False
    elapsed_ms: float = 0.0


class GenreProfile(BaseModel):
    genre: str
    label: str
    subgenres: list[str] = []
    n_songs: int
    danceability: float
    energy: float
    valence: float
    acousticness: float
    instrumentalness: float
    tempo: float


class GenreRecommendResponse(BaseModel):
    profile: GenreProfile
    recommender: str
    recommendations: list[RecommendationOut]
    elapsed_ms: float = 0.0


class GenreItem(BaseModel):
    genre: str
    label: str
    subgenres: list[str] = []
    n_songs: int
    popularity: float


class GenresResponse(BaseModel):
    genres: list[str]
    details: list[GenreItem] = []


class HealthResponse(BaseModel):
    status: str
    n_songs: Optional[int] = None
    n_genres: Optional[int] = None
    default_recommender: Optional[str] = None
