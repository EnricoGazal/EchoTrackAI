"""
Perfil do usuário a partir do questionário inicial.

1. Gosto musical: vetor médio das músicas ligadas às respostas (artistas
   escolhidos, músicas da adolescência e gêneros). É usado para gerar a
   playlist "Feito para você" com o mesmo recomendador do resto do sistema.

2. Palpite de idade: usa o "pico de reminiscência" (reminiscence bump). As
   músicas que mais marcam uma pessoa costumam ser as lançadas na
   adolescência, por volta dos 16 anos. Por isso o questionário pergunta
   quais músicas tocavam quando a pessoa tinha uns 15 anos:
       idade estimada = ano atual - ano de lançamento (mediana) + 16
   O palpite é mostrado como faixa e o usuário confirma ou corrige. As
   correções confirmadas ajustam os palpites seguintes (calibração).

3. Perfil musical: compara as características de áudio das músicas
   escolhidas com a média do catálogo (energia, alegria, dançabilidade,
   acústica) e mede o quanto a pessoa varia de gênero e foge dos hits.
   Descreve o gosto musical; não é um teste psicológico.
"""

from datetime import date

import numpy as np

# Músicas de várias épocas presentes no catálogo, com o ano de lançamento
# original (não o da remasterização que aparece no título).
ERA_SONGS = [
    ("0aym2LBJBk9DAYuHHutrIl", 1968),  # Hey Jude - The Beatles
    ("4u7EnebtmKWzUH433cf5Qv", 1975),  # Bohemian Rhapsody - Queen
    ("4UDmDIqJIbrW0hMBQMFOsM", 1977),  # Stayin' Alive - Bee Gees
    ("2WfaOiMkCvy7F5fcp2zZ8L", 1985),  # Take on Me - a-ha
    ("37ZJ0p5Jm13JPevGcx4SkF", 1986),  # Livin' On A Prayer - Bon Jovi
    ("6CKlOEq2vAnjQqPP55xh6G", 1989),  # Pais e Filhos - Legião Urbana
    ("2fYHTfE46mqnu3Q6iUA54J", 1990),  # Evidências - Chitãozinho & Xororó
    ("4CeeEOM32jQcH3eN9Q2dGj", 1991),  # Smells Like Teen Spirit - Nirvana
    ("5qqabIl2vWzo9ApSC317sa", 1995),  # Wonderwall - Oasis
    ("3vGvMhuNgM3KVuwHEwZWwI", 1999),  # Anna Júlia - Los Hermanos
    ("7iL6o9tox1zgHpKUfh9vuC", 2003),  # In Da Club - 50 Cent
    ("003vvx7Niy0yvhvHt4a68B", 2003),  # Mr. Brightside - The Killers
    ("1D4PL9B8gOg78jiHg3FvBb", 2008),  # Love Story - Taylor Swift
    ("4OSBTYWVwsQhGLF9NHvIbR", 2010),  # Rolling in the Deep - Adele
    ("32OlwWuMpZ6b0aN2RZOeMS", 2014),  # Uptown Funk - Mark Ronson, Bruno Mars
    ("6habFhsOp2NvshLv26DqMb", 2017),  # Despacito - Luis Fonsi
    ("2Fxmhks0bxGSBdJ92vM42m", 2019),  # bad guy - Billie Eilish
    ("3IAfUEeaXRX9s9UdKOJrFI", 2021),  # Envolver - Anitta
    ("4LRPiXqCikLlN15c3yImP7", 2022),  # As It Was - Harry Styles
]
ERA_YEAR = dict(ERA_SONGS)
TEEN_AGE = 16

AGE_RANGES = [
    {"id": "ate-17", "label": "Até 17 anos", "low": 10, "high": 17},
    {"id": "18-24", "label": "18 a 24 anos", "low": 18, "high": 24},
    {"id": "25-34", "label": "25 a 34 anos", "low": 25, "high": 34},
    {"id": "35-44", "label": "35 a 44 anos", "low": 35, "high": 44},
    {"id": "45-54", "label": "45 a 54 anos", "low": 45, "high": 54},
    {"id": "55+", "label": "55 anos ou mais", "low": 55, "high": 70},
]
AGE_RANGES_BY_ID = {r["id"]: r for r in AGE_RANGES}

CONTEXTS = {
    "estudar": "Estudando ou trabalhando",
    "treinar": "Treinando",
    "relaxar": "Relaxando",
    "festa": "Em festas",
    "transito": "No trânsito ou viajando",
    "dormir": "Para dormir",
}

FEATURES = ["energy", "valence", "danceability", "acousticness"]


def estimate_age(era_track_ids, calibration=0.0):
    """Palpite de idade pelas músicas da adolescência.
    Devolve None quando a pessoa não escolheu nenhuma."""
    years = sorted(ERA_YEAR[t] for t in era_track_ids if t in ERA_YEAR)
    if not years:
        return None
    middle = float(np.median(years))
    spread = (years[-1] - years[0]) / 2 if len(years) > 1 else 0
    age = date.today().year - middle + TEEN_AGE + calibration
    margin = min(10, 3 + spread / 2)
    return {
        "age": round(age),
        "low": max(10, round(age - margin)),
        "high": round(age + margin),
        "based_on": len(years),
    }


def range_for_age(age):
    for r in AGE_RANGES:
        if r["low"] <= age <= r["high"]:
            return r["id"]
    return AGE_RANGES[-1]["id"] if age > 55 else AGE_RANGES[0]["id"]


def music_profile(songs, catalog_means, catalog_stds, n_genres, contexts):
    """Traços do gosto musical a partir das músicas escolhidas (DataFrame)."""
    means = {f: float(songs[f].mean()) for f in FEATURES}
    z = {f: (means[f] - catalog_means[f]) / catalog_stds[f] for f in FEATURES}
    popularity = float(songs["popularity"].mean())

    candidates = [
        (z["energy"], "Movido a energia", "Prefere músicas intensas e com pegada."),
        (-z["energy"], "Calmaria", "Gosta de músicas tranquilas, sem pressa."),
        (z["valence"], "Alto astral", "Suas músicas têm clima alegre e positivo."),
        (-z["valence"], "Introspectivo", "Curte músicas mais densas e emotivas."),
        (z["danceability"], "Pista de dança", "Ritmo é com você: muita coisa para dançar."),
        (z["acousticness"], "Alma acústica", "Violão, voz e instrumentos de verdade."),
        (-z["acousticness"], "Plugado na tomada", "Prefere guitarras, sintetizadores e batidas a instrumentos acústicos."),
    ]
    if n_genres >= 5:
        candidates.append((0.9, "Explorador", "Transita por muitos gêneros diferentes."))
    elif n_genres <= 2:
        candidates.append((0.6, "Fiel ao estilo", "Sabe o que gosta e fica nos seus gêneros."))
    if popularity >= 65:
        candidates.append(((popularity - 55) / 20, "Antenado nos hits", "Está por dentro do que mais toca."))
    elif popularity <= 45:
        candidates.append(((55 - popularity) / 20, "Garimpeiro", "Gosta de achar artistas fora do óbvio."))

    traits = [
        {"label": label, "description": text, "score": round(float(score), 2)}
        for score, label, text in sorted(candidates, key=lambda c: -c[0])
        if score > 0.25
    ][:3]
    if not traits:
        traits = [{"label": "Equilibrado", "description": "Seu gosto fica perto da média de tudo o que existe no catálogo.", "score": 0}]

    return {
        "title": traits[0]["label"],
        "traits": traits,
        "features": {f: round(means[f], 3) for f in FEATURES},
        "catalog": {f: round(catalog_means[f], 3) for f in FEATURES},
        "tempo": round(float(songs["tempo"].mean())),
        "popularity": round(popularity),
        "contexts": [CONTEXTS[c] for c in contexts if c in CONTEXTS],
    }
