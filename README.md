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

- **Características de áudio:** dançabilidade, energia, acústica, alegria (valence), volume, andamento, duração, compasso, fala, instrumental e ao vivo, padronizadas na mesma escala
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
- **Feito para você:** um questionário inicial monta o seu perfil musical e as recomendações saem dele. Ao escolher um artista, aparecem logo ao lado outros de som parecido. No perfil, a pessoa também pode informar a idade.
- **Player do Spotify:** prévia de 30 segundos, ou a faixa inteira com Spotify Premium

Para usar o site é preciso criar uma conta (nome, e-mail e senha). O menu da conta, no pé da barra lateral, tem a opção **Sair**; para voltar, basta entrar com o mesmo e-mail e senha.

### 5. Avaliação

Como não há histórico de usuários reais, a avaliação é offline (`src/evaluate.py`): divisão em 70% treino, 15% validação e 15% teste, e 1.500 consultas no teste. Uma recomendação conta como acerto quando tem energia e alegria até 0,15 de diferença da música de partida e andamento até 8%.

| Método | Precision@10 | NDCG@10 | Gêneros por playlist | Popularidade média |
| --- | --- | --- | --- | --- |
| EchoTrack (áudio + gênero, com variedade) | 30,7% | 0,236 | 3,0 | 34,0 |
| Só a similaridade do cosseno | 29,0% | 0,229 | 2,5 | 33,7 |
| Fora da bolha | 30,4% | 0,233 | 3,2 | 26,6 |
| Aleatório | 2,0% | 0,015 | 7,1 | 33,2 |
| Mais populares | 2,4% | 0,022 | 4,0 | 96,5 |

O EchoTrack acerta cerca de 15 vezes mais que o aleatório, e o "fora da bolha" baixa a popularidade média quase sem perder acerto.

---

## 📁 Estrutura do projeto

```text
Sistemas-de-recomendacao/
├── app/                  API (FastAPI): rotas, contas, questionário e carga do modelo
├── src/                  dados e modelo
│   ├── preprocessing.py  limpeza dos dados
│   ├── features.py       vetor de 128 números de cada música
│   ├── recommender.py    similaridade, variedade, rádio dirigível, ponte e fora da bolha
│   ├── genres.py         agrupamento dos gêneros
│   ├── profile.py        perfil musical a partir do questionário
│   ├── build_model.py    gera o modelo em models/
│   ├── evaluate.py       avaliação offline
│   └── main.py           recomendador no terminal
├── frontend/             site (React + Vite), com o próprio README
├── data/dataset.csv      dataset Spotify Tracks
├── dev.sh                instala e liga tudo com um comando (macOS e Linux)
├── Dockerfile            imagem única para publicar (site + API + modelo)
├── render.yaml           configuração do Render
└── requirements.txt      dependências do Python
```

A pasta `data/` guarda só o dataset original. `models/`, `reports/` e `outputs/` são gerados pelos comandos e não vão para o Git.

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

Para ouvir a faixa inteira, crie um app no [Spotify Developer](https://developer.spotify.com/dashboard) e coloque o Client ID em `frontend/.env.local` (veja `frontend/.env.example`). Sem ele, a prévia de 30 segundos continua funcionando. O passo a passo está no [README do front-end](frontend/README.md).

### Outros comandos

Na pasta principal, com o `.venv` ativo:

```bash
python src/main.py                # recomendador no terminal (pede uma música)
python -m src.evaluate            # avaliação offline, cerca de 3 minutos; resultados em reports/
python src/genre_analysis.py      # gráficos dos gêneros em outputs/ (antes: pip install matplotlib)
```

---

## ☁️ Publicação

O `Dockerfile` compila o site, treina o modelo e sobe a API, que também entrega as páginas. No [Render](https://render.com), crie um **Blueprint** com este repositório (ele lê o `render.yaml`) e preencha:

- `SPOTIFY_CLIENT_ID`: Client ID do app no painel do Spotify;
- `DATABASE_URL`: um PostgreSQL (o plano gratuito do [Neon](https://neon.tech) atende), para as contas não sumirem a cada nova versão.

No painel do Spotify, adicione o endereço do site seguido de `/callback` nos *Redirect URIs*. No plano gratuito o serviço "dorme" depois de 15 minutos sem acesso, e o primeiro acesso seguinte leva cerca de um minuto.
