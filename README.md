# 🎵 EchoTrack: Sistema de Recomendação de Músicas

Sistema de recomendação de músicas **baseado em conteúdo**, construído sobre o dataset **Spotify Tracks** (114 mil faixas, 113 gêneros). A partir de uma música, o EchoTrack monta uma playlist de faixas com som parecido.

Projeto Integrador VI, Sistemas de Informação, PUC-Campinas.

---

## ⚙️ Como funciona

O EchoTrack recomenda pelo **som** de cada música, e não pelo que outras pessoas ouvem. Por isso funciona desde a primeira visita e também recomenda músicas pouco conhecidas.

```text
Dataset Spotify Tracks
        ↓
Limpeza dos dados
        ↓
Cada música vira um vetor de 128 números
        ↓
Comparação com todo o catálogo (similaridade do cosseno)
        ↓
Escolha das músicas, equilibrando semelhança e variedade
        ↓
Playlist: a música escolhida primeiro, depois da mais parecida para a menos parecida
```

### 1. Dados

A limpeza (`src/preprocessing.py`) tira valores nulos, músicas repetidas, durações acima de 20 minutos e BPM inválido. Sobram **89.512 músicas**. No site, os 113 gêneros aparecem agrupados em 24 categorias.

### 2. O vetor de cada música

Cada música vira um vetor de 128 números (`src/features.py`):

- **Características de áudio:** dançabilidade, energia, acústica, alegria (valence), volume, andamento, duração, fala, instrumental e ao vivo, padronizadas na mesma escala
- **Tonalidade**, de um jeito que tons vizinhos fiquem próximos
- **Modo** (maior ou menor) e se a letra é explícita
- **Gênero**, com um peso que mantém a playlist no estilo da música sem prendê-la a um gênero só

### 3. A playlist

O sistema mede a **similaridade do cosseno** entre o vetor da música escolhida e o de todas as outras e separa as 100 mais parecidas. Dessas, escolhe uma por vez a que é parecida com a música de partida **e** diferente das já escolhidas, para a playlist não ficar repetitiva (`src/recommender.py`).

### 4. No site

- **Playlist a partir de uma música**, com a afinidade de cada faixa e o porquê de ela ter entrado
- **Rádio dirigível:** controles para puxar a playlist para mais ou menos energia, acústica e alegria, e para mais semelhança ou mais variedade
- **Ponte entre duas músicas:** uma playlist que sai de uma música e chega em outra
- **Fora da bolha:** dá preferência às músicas menos populares entre as de som parecido
- **Feito para você:** um questionário inicial monta o seu perfil musical e as recomendações saem dele
- **Player do Spotify:** prévia de 30 segundos, ou a faixa inteira com Spotify Premium

Não há tela de login: na primeira visita o site cria uma conta de visitante, guardada no navegador.

---

## ▶️ Como rodar

Requisitos: **Python 3.9+** e **Node.js 20+**.

### 1. Instalar

```bash
git clone https://github.com/Luc7s/Sistemas-de-recomendacao.git
cd Sistemas-de-recomendacao

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt

cd frontend
npm install
cd ..
```

### 2. Gerar o modelo

Uma vez só, na pasta principal (cerca de 1 minuto):

```bash
python -m src.build_model
```

Os arquivos do modelo ficam em `models/`. Só é preciso gerar de novo se o dataset mudar.

### 3. Ligar o site

```bash
cd frontend
npm run dev
```

O comando liga o site e a API juntos. Abra **https://127.0.0.1:5173**. Na primeira vez o navegador mostra um aviso sobre o certificado local: clique em *Avançado → Continuar*. O Ctrl+C desliga os dois.

No macOS e no Linux, o `./dev.sh` faz tudo isso com um comando só, inclusive a instalação e o modelo.

### Spotify Premium (opcional)

Para ouvir a faixa inteira, crie um app no [Spotify Developer](https://developer.spotify.com/dashboard) e coloque o Client ID em `frontend/.env.local` (veja `frontend/.env.example`). Sem ele, a prévia de 30 segundos continua funcionando.
