import os

from data_loader import load_dataset
from data_types import identify_column_types
from preprocessing import clean_data
from features import build_features
from recommender import recommend_songs, recommend_songs_mmr


# Resultados gerados vão para outputs/; a pasta data/ guarda só o dataset original.
OUTPUT_DIR = "outputs"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    df = load_dataset()

    print("Tipos das colunas do dataset original:")
    print(identify_column_types(df).to_string(index=False))

    df_limpo = clean_data(df)

    X, feature_matrix, scaler = build_features(df_limpo)

    print(f"\nTotal de músicas: {X.shape[0]}")
    print(f"Total de features: {X.shape[1]}")

    track_name = input("\nDigite o nome da música: ")
    artist = input("Digite o artista (opcional): ")

    if artist.strip() == "":
        artist = None

    print("\nRECOMENDAÇÕES BASELINE")

    recommendations = recommend_songs(
        track_name,
        df_limpo,
        X,
        artist_hint=artist,
        n=10
    )

    if recommendations is None:
        print("Música não encontrada no dataset.")
    else:
        print(recommendations.to_string(index=False))
        recommendations.to_csv(
            os.path.join(OUTPUT_DIR, "recommendations_baseline.csv"),
            index=False
        )

    print("\nRECOMENDAÇÕES MMR")

    recommendations_mmr = recommend_songs_mmr(
        track_name,
        df_limpo,
        X,
        artist_hint=artist,
        n=10
    )

    if recommendations_mmr is None:
        print("Música não encontrada no dataset.")
    else:
        print(recommendations_mmr.to_string(index=False))
        recommendations_mmr.to_csv(
            os.path.join(OUTPUT_DIR, "recommendations_mmr.csv"),
            index=False
        )

    feature_matrix.to_csv(
        os.path.join(OUTPUT_DIR, "feature_matrix.csv"),
        index=False
    )

    print(f"\nArquivos salvos na pasta {OUTPUT_DIR}.")


if __name__ == "__main__":
    main()