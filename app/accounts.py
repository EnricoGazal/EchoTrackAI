"""
Contas de usuário, questionário inicial e playlist "Feito para você".

Banco de dados:
- No computador: SQLite em instance/echotrack.db (fora do Git).
- Na nuvem: Postgres, informado na variável de ambiente DATABASE_URL. É
  necessário porque o disco dos servidores gratuitos é apagado a cada
  reinício, e as contas sumiriam.

As senhas são guardadas com PBKDF2-SHA256 e sal aleatório, nunca em texto.
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from app.state import state
from app.router import to_song_out, to_recommendations, artist_out
from src.genres import GROUPS_BY_ID, group_label
from src.recommender import recommend_from_vector
from src.profile import (
    AGE_RANGES,
    AGE_RANGES_BY_ID,
    CONTEXTS,
    ERA_SONGS,
    FEATURES,
    estimate_age,
    music_profile,
    range_for_age,
)

DB_PATH = Path(__file__).resolve().parent.parent / "instance" / "echotrack.db"
PBKDF2_ROUNDS = 600_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

router = APIRouter()


# ----------------------------------------------------------------------
# Banco de dados
# ----------------------------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

SCHEMA_SQLITE = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    consent_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    onboarded INTEGER NOT NULL DEFAULT 0,
    answers TEXT,
    profile TEXT,
    predicted_age REAL,
    confirmed_range TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
"""
SCHEMA_POSTGRES = SCHEMA_SQLITE.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
_schema_ready = False


class Database:
    """Conexão única para SQLite ou Postgres. As consultas usam '?' e são
    convertidas para o formato do Postgres quando necessário."""

    def __init__(self):
        global _schema_ready
        self.postgres = bool(DATABASE_URL)
        if self.postgres:
            import psycopg
            from psycopg.rows import dict_row

            self.conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        else:
            DB_PATH.parent.mkdir(exist_ok=True)
            self.conn = sqlite3.connect(DB_PATH)
            self.conn.row_factory = sqlite3.Row
        if not _schema_ready:
            schema = SCHEMA_POSTGRES if self.postgres else SCHEMA_SQLITE
            for statement in schema.split(";"):
                if statement.strip():
                    self.conn.execute(statement)
            self.conn.commit()
            _schema_ready = True

    def execute(self, sql, params=()):
        if self.postgres:
            sql = sql.replace("?", "%s")
        return self.conn.execute(sql, params)

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()


def db():
    return Database()


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ROUNDS
    ).hex()


def new_session(conn, user_id):
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_id, datetime.now().isoformat()),
    )
    conn.commit()
    return token


def current_user(authorization: Optional[str] = Header(None)):
    """Usuário dono do token enviado em 'Authorization: Bearer <token>'."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Faça login para continuar.")
    token = authorization[7:]
    conn = db()
    row = conn.execute(
        "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE token = ?",
        (token,),
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=401, detail="Sua sessão expirou. Entre de novo.")
    return dict(row, token=token)


def public_user(user):
    return {
        "name": user["name"],
        "email": user["email"],
        "onboarded": bool(user["onboarded"]),
        "profile": json.loads(user["profile"]) if user["profile"] else None,
    }


# ----------------------------------------------------------------------
# Cadastro e login
# ----------------------------------------------------------------------

class SignupIn(BaseModel):
    name: str
    email: str
    password: str
    consent: bool


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/auth/signup")
def signup(body: SignupIn):
    name = body.name.strip()
    email = body.email.strip().lower()
    if not name:
        raise HTTPException(status_code=422, detail="Informe como você quer ser chamado.")
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Esse e-mail não parece válido. Confira e tente de novo.")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="A senha precisa ter pelo menos 8 caracteres.")
    if not body.consent:
        raise HTTPException(status_code=422, detail="Para criar a conta, aceite o uso dos seus dados.")

    conn = db()
    if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="Esse e-mail já tem uma conta. Entre com ele.")

    salt = secrets.token_hex(16)
    now = datetime.now().isoformat()
    user_id = conn.execute(
        "INSERT INTO users (name, email, password_hash, salt, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        (name, email, hash_password(body.password, salt), salt, now, now),
    ).fetchone()["id"]
    token = new_session(conn, user_id)
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return {"token": token, "user": public_user(dict(user))}


@router.post("/auth/login")
def login(body: LoginIn):
    conn = db()
    user = conn.execute(
        "SELECT * FROM users WHERE email = ?", (body.email.strip().lower(),)
    ).fetchone()
    ok = user is not None and hmac.compare_digest(
        hash_password(body.password, user["salt"]), user["password_hash"]
    )
    if not ok:
        conn.close()
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    token = new_session(conn, user["id"])
    conn.close()
    return {"token": token, "user": public_user(dict(user))}


@router.post("/auth/logout")
def logout(user=Depends(current_user)):
    conn = db()
    conn.execute("DELETE FROM sessions WHERE token = ?", (user["token"],))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.get("/me")
def me(user=Depends(current_user)):
    return public_user(user)


@router.delete("/me")
def delete_account(user=Depends(current_user)):
    """Apaga a conta e todas as respostas (direito de exclusão da LGPD)."""
    conn = db()
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
    conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()
    return {"ok": True}


# ----------------------------------------------------------------------
# Questionário
# ----------------------------------------------------------------------

@router.get("/onboarding/options")
def onboarding_options():
    era = []
    for track_id, _year in ERA_SONGS:
        idx = state.id_to_index.get(track_id)
        if idx is not None:
            era.append(to_song_out(state.df_clean.iloc[idx]))
    return {
        "era_songs": era,
        "contexts": [{"id": k, "label": v} for k, v in CONTEXTS.items()],
        "age_ranges": [{"id": r["id"], "label": r["label"]} for r in AGE_RANGES],
    }


@router.get("/onboarding/artists")
def onboarding_artists(genres: str = Query(""), limit: int = Query(30, ge=1, le=60)):
    """Artistas populares dos gêneros escolhidos, alternando entre eles."""
    chosen = [g for g in genres.split(",") if g in GROUPS_BY_ID] or list(GROUPS_BY_ID)
    lists = [state.top_artists_by_group.get(g, []) for g in chosen]
    picked, seen = [], set()
    for i in range(max((len(l) for l in lists), default=0)):
        for l in lists:
            if i < len(l) and l[i] not in seen:
                seen.add(l[i])
                picked.append(artist_out(l[i]))
            if len(picked) == limit:
                return {"artists": picked}
    return {"artists": picked}


class OnboardingIn(BaseModel):
    genres: List[str] = []
    artists: List[str] = []
    era_songs: List[str] = []
    contexts: List[str] = []


def age_calibration(conn):
    """Erro médio dos palpites já confirmados pelos usuários (em anos)."""
    rows = conn.execute(
        "SELECT predicted_age, confirmed_range FROM users WHERE predicted_age IS NOT NULL AND confirmed_range IS NOT NULL"
    ).fetchall()
    diffs = []
    for r in rows:
        rng = AGE_RANGES_BY_ID.get(r["confirmed_range"])
        if rng:
            diffs.append((rng["low"] + rng["high"]) / 2 - r["predicted_age"])
    return float(np.mean(diffs)) if len(diffs) >= 3 else 0.0


@router.post("/onboarding")
def onboarding(body: OnboardingIn, user=Depends(current_user)):
    df = state.df_clean
    genres = [g for g in body.genres if g in GROUPS_BY_ID]
    artists = [a for a in body.artists if a in state.artist_songs]
    era = [t for t in body.era_songs if t in state.id_to_index]
    if not genres and not artists:
        raise HTTPException(status_code=422, detail="Escolha pelo menos um gênero ou artista.")

    # Músicas que representam o gosto: as 5 mais populares de cada artista
    # escolhido e as músicas da adolescência marcadas.
    idx = []
    pop = df["popularity"].to_numpy()
    for a in artists:
        songs = state.artist_songs[a]
        idx.extend(songs[np.argsort(-pop[songs])][:5].tolist())
    idx.extend(state.id_to_index[t] for t in era)

    vectors = [state.X[idx].mean(axis=0)] if idx else []
    vectors += [state.genre_profiles[g] for g in genres if g in state.genre_profiles]
    taste = np.mean(vectors, axis=0)

    sample = df.iloc[idx] if idx else df[df["genre_group"].isin(genres)]
    n_genres = len(set(genres) | set(sample["genre_group"]))

    conn = db()
    age = estimate_age(era, age_calibration(conn))
    profile = music_profile(sample, state.catalog_means, state.catalog_stds, n_genres, body.contexts)
    profile["age_guess"] = age
    profile["age_range_guess"] = range_for_age(age["age"]) if age else None
    profile["age_confirmed"] = None
    profile["top_genres"] = [group_label(g) for g in sample["genre_group"].value_counts().index[:3]] or [group_label(g) for g in genres[:3]]
    profile["artists"] = artists[:6]
    profile["seeds"] = {"artists": artists[:8], "era_songs": era[:6], "genres": genres[:4]}
    profile["taste"] = [round(float(v), 5) for v in taste]

    conn.execute(
        "UPDATE users SET onboarded = 1, answers = ?, profile = ?, predicted_age = ?, confirmed_range = NULL WHERE id = ?",
        (json.dumps(body.model_dump()), json.dumps(profile), age["age"] if age else None, user["id"]),
    )
    conn.commit()
    conn.close()
    return public_profile(profile)


def public_profile(profile):
    return {k: v for k, v in profile.items() if k != "taste"}


class AgeIn(BaseModel):
    range: str


@router.post("/me/age")
def confirm_age(body: AgeIn, user=Depends(current_user)):
    """Usuário confirma ou corrige o palpite de idade; isso calibra os próximos."""
    if body.range not in AGE_RANGES_BY_ID or not user["profile"]:
        raise HTTPException(status_code=422, detail="Faixa de idade inválida.")
    profile = json.loads(user["profile"])
    profile["age_confirmed"] = AGE_RANGES_BY_ID[body.range]["label"]
    conn = db()
    conn.execute(
        "UPDATE users SET confirmed_range = ?, profile = ? WHERE id = ?",
        (body.range, json.dumps(profile), user["id"]),
    )
    conn.commit()
    conn.close()
    return public_profile(profile)


@router.get("/me/for-you")
def for_you(n: int = Query(12, ge=1, le=50), user=Depends(current_user)):
    """Playlist 'Feito para você', como os mixes do Spotify: o recomendador
    roda a partir de cada artista, música e gênero das respostas, e os
    resultados são intercalados. A média de gostos muito diferentes cairia
    num "meio-termo" que não representa nenhum deles."""
    if not user["profile"]:
        raise HTTPException(status_code=404, detail="Responda o questionário primeiro.")
    profile = json.loads(user["profile"])
    seeds = profile.get("seeds") or {}

    # Cada gosto do perfil vira um ponto de partida, com o motivo que a
    # interface mostra ("Porque você curte Coldplay").
    vectors, labels, own = [], [], set()
    for a in seeds.get("artists", []):
        if a in state.artist_songs:
            vectors.append(state.X[state.artist_songs[a]].mean(axis=0))
            labels.append(f"Porque você curte {a}")
            own.update(state.artist_songs[a].tolist())
    for t in seeds.get("era_songs", []):
        if t in state.id_to_index:
            i = state.id_to_index[t]
            vectors.append(state.X[i])
            labels.append(f"Porque você escolheu {state.df_clean['track_name'].iat[i]}")
            own.add(i)
    for g in seeds.get("genres", []):
        if g in state.genre_profiles:
            vectors.append(state.genre_profiles[g])
            labels.append(f"Porque você curte {group_label(g)}")
    if not vectors:
        vectors = [np.array(profile["taste"], dtype=np.float32)]
        labels = ["Do seu perfil musical"]

    per_seed = max(3, -(-n // len(vectors)) + 2)
    lists = []
    for v, label in zip(vectors, labels):
        recs = recommend_from_vector(
            v, state.df_clean, state.X, state.base_titles, state.artist_sets,
            n=per_seed, method="mmr",
        )
        recs["because"] = label
        lists.append(recs)

    # Intercala as listas, sem repetir música nem trazer as já escolhidas.
    picked, seen_titles = [], set()
    for i in range(per_seed):
        for recs in lists:
            if i >= len(recs) or len(picked) == n:
                continue
            row = recs.iloc[i]
            idx = state.id_to_index.get(str(row["track_id"]))
            title = state.base_titles[idx] if idx is not None else row["track_name"]
            if idx in own or title in seen_titles:
                continue
            seen_titles.add(title)
            picked.append(row)
    return {"recommendations": to_recommendations(pd.DataFrame(picked))}
