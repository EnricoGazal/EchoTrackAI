"""
Avaliação offline do recomendador do EchoTrack.

    python -m src.evaluate            (a partir da raiz do repositório, ~3 min)

Gera reports/avaliacao_resultados.csv e reports/avaliacao_validacao.csv.

Como não há histórico de escuta de usuários reais, a avaliação é offline:

- Divisão estratificada por subgênero: 70% treino (catálogo onde a busca
  acontece e onde o StandardScaler é ajustado), 15% validação (escolha do peso
  do gênero e do λ do MMR) e 15% teste (resultado final). Semente fixa (42).
- Critério de acerto "pelo som": uma recomendação é relevante quando tem
  energia, clima (valence) e andamento (BPM) próximos aos da música de partida.
  Há três níveis de tolerância:

      nível      energia   clima   andamento (fração do BPM)
      rígido      0,10      0,10        5%
      padrão      0,15      0,15        8%
      flexível    0,20      0,20       10%

  Precision@K e Recall@K usam o nível padrão. O NDCG@K usa relevância
  graduada: 3 (rígido), 2 (padrão), 1 (flexível) e 0 (fora dos três).
- Também são medidos: coerência de estilo (mesmo subgênero), gêneros e
  artistas distintos por playlist, popularidade média e tempo por consulta.
"""
import json
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from src.data_loader import load_dataset
from src.features import BINARY_FEATURES, CYCLIC_FEATURES, GENRE_WEIGHT, SKEWED_FEATURES, STANDARDIZE_FEATURES
from src.genres import group_of
from src.preprocessing import clean_data
from src.recommender import _is_same_song, base_title, mmr_select, normalize_rows

SEED = 42
KS = (5, 10, 20)
N_QUERIES = 1500        # consultas por etapa
N_VALID_GRID = 600      # consultas por combinação na busca de hiperparâmetros
LAM = 0.75
POOL = 100
OBSCURITY = 0.06        # mesmo valor do modo "fora da bolha" da API
LEVELS = {              # energia, clima, fração do BPM
    "rigido": (0.10, 0.10, 0.05),
    "padrao": (0.15, 0.15, 0.08),
    "flexivel": (0.20, 0.20, 0.10),
}
OUT = Path("reports")


# ----------------------------------------------------------------- dados
def split(df):
    idx = np.arange(len(df))
    tr, tmp = train_test_split(idx, test_size=0.30, random_state=SEED, stratify=df["track_genre"])
    va, te = train_test_split(tmp, test_size=0.50, random_state=SEED, stratify=df["track_genre"].iloc[tmp])
    return tr, va, te


def feature_blocks(df, train_idx):
    """Mesmas transformações de src/features.py, com o scaler ajustado só no treino."""
    f = df.copy()
    f["explicit"] = f["explicit"].astype(int)
    for c in SKEWED_FEATURES:
        f[c] = np.log1p(f[c])
    f["key_sin"] = np.sin(2 * np.pi * f["key"] / 12)
    f["key_cos"] = np.cos(2 * np.pi * f["key"] / 12)
    scaler = StandardScaler().fit(f.iloc[train_idx][STANDARDIZE_FEATURES])
    f[STANDARDIZE_FEATURES] = scaler.transform(f[STANDARDIZE_FEATURES])
    f[BINARY_FEATURES] = f[BINARY_FEATURES] - 0.5
    audio = f[STANDARDIZE_FEATURES + BINARY_FEATURES + CYCLIC_FEATURES].to_numpy(np.float32)
    genres = sorted(df["track_genre"].iloc[train_idx].unique())
    onehot = pd.get_dummies(pd.Categorical(df["track_genre"], categories=genres)).to_numpy(np.float32)
    return audio, onehot


# ----------------------------------------------------------------- recomendação
class Evaluator:
    def __init__(self, df, index):
        self.df = df
        self.index = index
        self.titles = df["track_name"].fillna("").map(base_title).to_numpy()
        self.artists = [frozenset(a.strip() for a in str(x).split(";") if a.strip()) for x in df["artists"]]
        self.main_artist = df["artists"].astype(str).str.split(";").str[0].to_numpy()
        self.sub = df["track_genre"].to_numpy()
        self.group = df["genre_group"].to_numpy()
        self.pop = df["popularity"].to_numpy()
        self.energy = df["energy"].to_numpy()
        self.valence = df["valence"].to_numpy()
        self.tempo = df["tempo"].to_numpy()
        self.in_index = np.zeros(len(df), bool)
        self.in_index[index] = True

    def recommend(self, Xn_index, q_vec, q, n, method, lam=LAM, obscurity=0.0):
        """Mesma lógica de src/recommender.fast_recommend, buscando só no
        catálogo de treino e descartando a própria música e outras versões dela."""
        sims = Xn_index @ q_vec
        wide = POOL * (12 if obscurity > 0 else 3)
        order = np.argpartition(-sims, wide)[:wide]
        score = sims[order] - (obscurity * self.pop[self.index[order]] / 100 if obscurity > 0 else 0)
        order = order[np.argsort(-score)]
        size = n if method == "baseline" else max(POOL, n)
        kept, seen = [], []
        for o in order:
            i = self.index[o]
            if i == q or _is_same_song(self.titles[i], self.artists[i], self.titles[q], self.artists[q]):
                continue
            if any(_is_same_song(self.titles[i], self.artists[i], t, a) for t, a in seen):
                continue
            kept.append(o)
            seen.append((self.titles[i], self.artists[i]))
            if len(kept) == size:
                break
        kept = np.array(kept)
        if method == "baseline":
            return self.index[kept[:n]]
        relevance = sims[kept] - (obscurity * self.pop[self.index[kept]] / 100 if obscurity > 0 else 0)
        return self.index[kept[mmr_select(Xn_index, kept, relevance, n, lam)]]

    # ------------------------------------------------------------- métricas
    def close(self, q, items, level):
        de, dv, dt = LEVELS[level]
        return ((np.abs(self.energy[items] - self.energy[q]) <= de)
                & (np.abs(self.valence[items] - self.valence[q]) <= dv)
                & (np.abs(self.tempo[items] - self.tempo[q]) <= dt * self.tempo[q]))

    def metrics(self, q, recs):
        out = {}
        gain = np.zeros(len(recs))
        for level, g in (("flexivel", 1), ("padrao", 2), ("rigido", 3)):
            gain[self.close(q, recs, level)] = g
        rel = gain >= 2
        n_rel = int(self.close(q, self.index, "padrao").sum()) - int(self.in_index[q])
        disc = 1 / np.log2(np.arange(2, max(KS) + 2))
        for k in KS:
            out[f"P@{k}"] = rel[:k].mean()
            out[f"R@{k}"] = rel[:k].sum() / max(n_rel, 1)
            dcg = ((2 ** gain[:k] - 1) * disc[:k]).sum()
            ideal = np.sort(self.ideal_gains(q))[::-1][:k]
            idcg = ((2 ** ideal - 1) * disc[: len(ideal)]).sum()
            out[f"NDCG@{k}"] = dcg / idcg if idcg > 0 else 0.0
        r10 = recs[:10]
        for level in LEVELS:
            out[f"P@10_{level}"] = self.close(q, r10, level).mean()
        out["estilo@10"] = (self.sub[r10] == self.sub[q]).mean()
        out["generos@10"] = len(set(self.group[r10]))
        out["artistas@10"] = len(set(self.main_artist[r10]))
        out["popularidade@10"] = self.pop[r10].mean()
        out["teto_R@10"] = min(10, n_rel) / max(n_rel, 1)
        return out

    def ideal_gains(self, q):
        """Ganhos da lista ideal: as melhores músicas possíveis do catálogo."""
        mask = self.in_index.copy()
        mask[q] = False
        cand = np.flatnonzero(mask)
        g = np.zeros(len(cand))
        for level, v in (("flexivel", 1), ("padrao", 2), ("rigido", 3)):
            g[self.close(q, cand, level)] = v
        return np.sort(g)[::-1][: max(KS)]


def run(ev, X, queries, method, lam=LAM, obscurity=0.0, kmax=max(KS)):
    Xn = normalize_rows(X)
    Xn_index = Xn[ev.index]
    rows, t0 = [], time.perf_counter()
    for q in queries:
        recs = ev.recommend(Xn_index, Xn[q], q, kmax, method, lam, obscurity)
        rows.append(ev.metrics(q, recs))
    ms = (time.perf_counter() - t0) / len(queries) * 1000
    m = pd.DataFrame(rows).mean().to_dict()
    m["ms_por_consulta"] = ms
    return m


def run_naive(ev, queries, kind, rng):
    rows = []
    top = ev.index[np.argsort(-ev.pop[ev.index])]
    for q in queries:
        if kind == "aleatorio":
            recs = rng.choice(ev.index[ev.index != q], max(KS), replace=False)
        else:
            recs = top[top != q][: max(KS)]
        rows.append(ev.metrics(q, recs))
    m = pd.DataFrame(rows).mean().to_dict()
    m["ms_por_consulta"] = np.nan
    return m


def main():
    OUT.mkdir(exist_ok=True)
    df = clean_data(load_dataset())
    df["genre_group"] = df["track_genre"].map(group_of)
    tr, va, te = split(df)
    audio, onehot = feature_blocks(df, tr)
    matrix = lambda w: np.hstack([audio, onehot * w]).astype(np.float32)
    ev = Evaluator(df, tr)
    rng = np.random.default_rng(SEED)
    queries = {name: rng.choice(ids, size=min(N_QUERIES, len(ids)), replace=False)
               for name, ids in (("treino", tr), ("validacao", va), ("teste", te))}

    # 1) Validação: peso do gênero x λ do MMR
    grid = []
    for w in (0.0, 0.6, 1.2, 2.0):
        X = matrix(w)
        for lam in (0.5, 0.75, 0.9, 1.0):
            m = run(ev, X, queries["validacao"][:N_VALID_GRID], "mmr", lam)
            m.update(peso_genero=w, lam=lam)
            grid.append(m)
            print(f"validação  peso={w}  λ={lam}  NDCG@10={m['NDCG@10']:.3f}  gêneros={m['generos@10']:.2f}")
    pd.DataFrame(grid).to_csv(OUT / "avaliacao_validacao.csv", index=False)

    # 2) Configuração final nas três etapas + comparações no teste
    X_prod, X_audio = matrix(GENRE_WEIGHT), matrix(0.0)
    results = []
    methods = {
        "Áudio + gênero (MMR, produção)": dict(X=X_prod, method="mmr"),
        "Áudio + gênero (cosseno)": dict(X=X_prod, method="baseline"),
        "Somente áudio (MMR)": dict(X=X_audio, method="mmr"),
        "Fora da bolha (MMR)": dict(X=X_prod, method="mmr", obscurity=OBSCURITY),
    }
    for etapa in ("treino", "validacao", "teste"):
        for name, cfg in methods.items():
            if etapa != "teste" and name != "Áudio + gênero (MMR, produção)":
                continue
            m = run(ev, cfg["X"], queries[etapa], cfg["method"], obscurity=cfg.get("obscurity", 0.0))
            m.update(etapa=etapa, metodo=name)
            results.append(m)
            print(etapa, name, {k: round(v, 3) for k, v in m.items() if isinstance(v, float)})
    for kind, name in (("aleatorio", "Aleatório"), ("populares", "Mais populares")):
        m = run_naive(ev, queries["teste"], kind, rng)
        m.update(etapa="teste", metodo=name)
        results.append(m)
    pd.DataFrame(results).to_csv(OUT / "avaliacao_resultados.csv", index=False)
    info = {"treino": len(tr), "validacao": len(va), "teste": len(te), "consultas": N_QUERIES, "niveis": LEVELS}
    (OUT / "avaliacao_info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Resultados salvos em", OUT.resolve())


if __name__ == "__main__":
    main()
