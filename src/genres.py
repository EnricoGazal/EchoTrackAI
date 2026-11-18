"""
Agrupamento dos 113 gêneros do dataset em gêneros principais.

O dataset do Spotify separa os estilos em muitos subgêneros (alt-rock,
punk-rock, psych-rock...). Para o usuário, eles são agrupados em gêneros
mais amplos ("Rock"), usados na navegação e na playlist por gênero.

O modelo de recomendação continua usando os 113 subgêneros, que deixam a
similaridade mais precisa.

Alguns nomes do dataset não correspondem ao estilo das músicas. A
classificação considerou os artistas mais populares de cada um, por exemplo:
- "hardcore" reúne hip-hop (The Notorious B.I.G., Mobb Deep, Wu-Tang Clan);
- "groove" reúne groove metal (Pantera, Lamb of God);
- "world-music" reúne música gospel e worship (Hillsong, Housefires);
- "romance" reúne canções românticas russas (Valery Obodzinsky);
- "happy" reúne happy hardcore e hardstyle (Scooter, Darren Styles).
"""

GENRE_GROUPS = [
    {
        "id": "rock",
        "label": "Rock",
        "genres": [
            "rock", "alt-rock", "alternative", "british", "emo", "garage",
            "goth", "grunge", "hard-rock", "indie", "j-rock", "power-pop",
            "psych-rock", "punk", "punk-rock", "rock-n-roll", "rockabilly",
        ],
    },
    {
        "id": "metal",
        "label": "Metal",
        "genres": [
            "metal", "black-metal", "death-metal", "grindcore", "groove",
            "heavy-metal", "industrial", "metalcore",
        ],
    },
    {
        "id": "pop",
        "label": "Pop",
        "genres": [
            "pop", "acoustic", "french", "german", "indie-pop", "party",
            "singer-songwriter", "swedish", "synth-pop",
        ],
    },
    {
        "id": "pop-asiatico",
        "label": "Pop asiático",
        "genres": ["anime", "cantopop", "j-idol", "j-pop", "k-pop", "mandopop"],
    },
    {
        "id": "eletronica",
        "label": "Eletrônica",
        "genres": [
            "electronic", "breakbeat", "chicago-house", "club", "dance",
            "deep-house", "detroit-techno", "disco", "drum-and-bass",
            "dubstep", "edm", "electro", "happy", "hardstyle", "house", "idm",
            "minimal-techno", "progressive-house", "techno", "trance",
            "trip-hop",
        ],
    },
    {
        "id": "hip-hop",
        "label": "Hip-hop e R&B",
        "genres": ["hip-hop", "funk", "hardcore", "j-dance", "r-n-b", "sad", "soul"],
    },
    {
        "id": "reggae",
        "label": "Reggae e afro",
        "genres": ["reggae", "afrobeat", "dancehall", "dub", "ska"],
    },
    {
        "id": "latina",
        "label": "Latina",
        "genres": ["latin", "latino", "reggaeton", "salsa", "spanish", "tango"],
    },
    {
        "id": "brasileira",
        "label": "Brasileira",
        "genres": ["brazil", "forro", "mpb", "pagode", "samba", "sertanejo"],
    },
    {
        "id": "jazz-blues",
        "label": "Jazz e blues",
        "genres": ["jazz", "blues", "guitar"],
    },
    {
        "id": "country-folk",
        "label": "Country e folk",
        "genres": ["country", "bluegrass", "folk", "honky-tonk"],
    },
    {
        "id": "classica",
        "label": "Clássica",
        "genres": ["classical", "opera", "piano"],
    },
    {
        "id": "relaxante",
        "label": "Para relaxar",
        "genres": ["ambient", "chill", "new-age", "sleep", "study"],
    },
    {
        "id": "gospel",
        "label": "Gospel",
        "genres": ["gospel", "world-music"],
    },
    {
        "id": "trilhas",
        "label": "Trilhas e musicais",
        "genres": ["pop-film", "show-tunes"],
    },
    {
        "id": "infantil",
        "label": "Infantil",
        "genres": ["children", "disney", "kids"],
    },
    {
        "id": "mundo",
        "label": "Música do mundo",
        "genres": ["indian", "iranian", "malay", "romance", "turkish"],
    },
    {
        "id": "humor",
        "label": "Humor",
        "genres": ["comedy"],
    },
]

GROUPS_BY_ID = {g["id"]: g for g in GENRE_GROUPS}
GENRE_TO_GROUP = {
    genre: group["id"] for group in GENRE_GROUPS for genre in group["genres"]
}


def group_of(genre):
    """Id do gênero principal de um subgênero do dataset."""
    return GENRE_TO_GROUP.get(genre, "outros")


def group_label(group_id):
    group = GROUPS_BY_ID.get(group_id)
    return group["label"] if group else "Outros"
