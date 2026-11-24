# EchoTrack: Sistema de Recomendação de Músicas

Projeto Integrador VI (Sistemas de Informação, PUC-Campinas). O EchoTrack recomenda músicas pelo **som** de cada faixa, e não pelo que outras pessoas ouvem: a partir de uma música, ele monta uma playlist de faixas parecidas, explica por que cada uma entrou e deixa o usuário conduzir o resultado.

É um sistema de **filtragem baseada em conteúdo** (*Content-Based Filtering*): não usa histórico de usuários, só as características de áudio e o gênero das músicas.

## Tecnologias

| Parte | Tecnologias |
| --- | --- |
| Dados e modelo | Python, pandas, NumPy, scikit-learn, Matplotlib (gráficos) |
| API | FastAPI, Uvicorn, SQLite (local) ou PostgreSQL (nuvem) |
| Site | React, Vite, Tailwind CSS, Radix UI, Motion |
| Música | Player oficial do Spotify (prévia de 30 s ou faixa inteira com Spotify Premium) |
| Publicação | Docker, Render, Neon |

## Como funciona

### 1. Dados

Dataset Spotify Tracks (`data/dataset.csv`), com 114.000 faixas e 113 gêneros. O tratamento (`src/preprocessing.py`):

- remove valores nulos;
- remove músicas com `track_id` repetido e registros duplicados;
- remove durações inválidas ou acima de 20 minutos;
- remove músicas com BPM inválido.

Depois da limpeza ficam **89.512 músicas**. No site, os 113 gêneros aparecem agrupados em 24 categorias (`src/genres.py`).

### 2. Engenharia de características

Cada música vira um vetor de **128 números** (`src/features.py`):

- **11 características numéricas padronizadas** com `StandardScaler`: danceability, energy, acousticness, valence, loudness, tempo, duration_ms, time_signature, speechiness, instrumentalness e liveness. As três últimas são assimétricas e passam antes por `log1p`.
- **Tonalidade (`key`) em seno e cosseno**, para que tons vizinhos no ciclo (como dó e si) fiquem próximos.
- **`mode` e `explicit`** como 0 ou 1.
- **113 gêneros em one-hot**, com peso 1,2. O peso foi escolhido na validação: sem ele as playlists misturam estilos, e com peso maior ficam presas a um gênero só.

### 3. Recomendação

Dois métodos (`src/recommender.py`):

- **Similaridade do cosseno (baseline):** compara o vetor da música escolhida com todo o catálogo e devolve as mais parecidas. Os vetores ficam normalizados na memória, então a comparação é uma única multiplicação de matrizes.
- **MMR (Maximal Marginal Relevance), o método padrão:** entre as 100 músicas mais parecidas, escolhe uma por vez a que tem a maior pontuação

  `λ × semelhança com a música de partida − (1 − λ) × semelhança com as músicas já escolhidas`

  com λ = 0,75. Assim a playlist continua parecida com a música de partida, mas sem faixas repetitivas.

### 4. Avaliação

Como não há histórico de escuta de usuários reais, a avaliação é offline (`src/evaluate.py`):

- divisão estratificada por subgênero em 70% treino, 15% validação e 15% teste, com semente 42;
- 1.500 consultas por etapa;
- uma recomendação conta como acerto "pelo som" quando a energia e o clima (valence) ficam a até 0,15 da música de partida e o andamento a até 8%;
- métricas: Precision@10, Recall@10, NDCG@10 (com relevância graduada em três níveis de tolerância), gêneros por playlist e popularidade média.

Resultados no conjunto de teste:

| Método | Precision@10 | NDCG@10 | Mesmo subgênero | Gêneros por playlist | Popularidade média |
| --- | --- | --- | --- | --- | --- |
| MMR, áudio + gênero (padrão) | 30,7% | 0,236 | 68% | 3,0 | 34,0 |
| Cosseno, áudio + gênero | 29,0% | 0,229 | 73% | 2,5 | 33,7 |
| Somente áudio (MMR) | 40,8% | 0,323 | 11% | 5,2 | 34,4 |
| Fora da bolha (MMR) | 30,4% | 0,233 | 67% | 3,2 | 26,6 |
| Aleatório | 2,0% | 0,015 | 1% | 7,1 | 33,2 |
| Mais populares | 2,4% | 0,022 | 1% | 4,0 | 96,5 |

O modelo padrão acerta cerca de 15 vezes mais que o aleatório. O "somente áudio" acerta mais o som, mas mistura estilos sem relação (só 11% do mesmo subgênero); por isso o gênero entra no vetor. Treino, validação e teste dão Precision@10 de 29,8%, 30,4% e 30,7%, sem sinal de sobreajuste.

## EchoTrack: a aplicação

Interface web (React) e API (FastAPI) sobre o mesmo modelo. A interface mostra de onde cada recomendação veio e por quê.

- **Explicação de cada recomendação:** afinidade (similaridade do cosseno), as 3 características que mais aproximam a faixa da música de partida e se ela entrou por ser muito parecida ou "para variar" (escolha do MMR).
- **Rádio dirigível:** controles que puxam a playlist para mais (ou menos) energia, acústica e alegria, e um controle "parecido ↔ variado" que ajusta o λ do MMR. Cada controle desloca o vetor de partida em até 1,5 desvio-padrão na característica escolhida; o modelo não é retreinado.
- **Ponte entre duas músicas:** paradas ao longo da reta entre os vetores das duas músicas; em cada parada entra a faixa mais próxima ainda não usada, dentro dos estilos das duas pontas.
- **Fora da bolha:** dentro das músicas de som mais próximo, as menos populares sobem no ranking (o contrário do viés de popularidade).
- **Contas e Feito para você:** cadastro com consentimento, questionário inicial e recomendações a partir do perfil, cada uma dizendo de qual gosto ela veio.

Principais rotas da API:

| Rota | O que faz |
| --- | --- |
| `GET /api/recommend/{track_id}` | Playlist a partir de uma música. Parâmetros: `n`, `lam`, `energy`, `acousticness`, `valence` (-1 a 1) e `obscure` |
| `GET /api/recommend/genre/{genre}` | Playlist pelo som médio de um gênero (`lam`, `obscure`) |
| `GET /api/bridge?from=&to=&n=` | Ponte entre duas músicas (`obscure`) |
| `GET /api/search?q=` | Busca por título e artista |
| `GET /api/artist?name=` | Músicas do artista e artistas de som parecido |
| `GET /api/me/for-you` | Recomendações do perfil (precisa de login) |
| `GET /api/health` | Estado da API e tamanho do catálogo |

Cada resposta de recomendação traz `elapsed_ms`, o tempo que o modelo levou (cerca de 8 ms por recomendação).

## Estrutura do projeto

```text
Sistemas-de-recomendacao/
├── app/                    API (FastAPI)
│   ├── main.py             cria a API e entrega o site publicado
│   ├── router.py           busca, recomendação, rádio, ponte, gêneros e capas
│   ├── accounts.py         contas, questionário e Feito para você
│   ├── schemas.py          formatos das respostas
│   └── state.py            carrega o modelo na memória
├── src/                    dados e modelo
│   ├── main.py             recomendador no terminal
│   ├── data_loader.py      leitura do dataset
│   ├── data_types.py       tipos das colunas
│   ├── preprocessing.py    limpeza dos dados
│   ├── genre_analysis.py   gráficos dos gêneros
│   ├── genres.py           24 categorias de gênero
│   ├── features.py         vetor de 128 características
│   ├── recommender.py      cosseno, MMR, rádio dirigível, ponte e fora da bolha
│   ├── profile.py          perfil musical a partir do questionário
│   ├── build_model.py      gera os arquivos do modelo em models/
│   ├── persistence.py      salva e carrega o modelo
│   └── evaluate.py         avaliação offline
├── frontend/               site (React + Vite)
├── data/                   dataset e resultados do recomendador no terminal
├── models/                 modelo gerado (fora do Git)
├── outputs/                gráficos dos gêneros (fora do Git)
├── reports/                resultados da avaliação (fora do Git)
├── dev.sh                  liga a API e o site com um comando
├── Dockerfile              imagem única para publicação
├── render.yaml             configuração do Render
└── requirements.txt
```

`models/`, `outputs/` e `reports/` são gerados pelos comandos abaixo e não vão para o Git.

## Como executar

### Opção 1: o site inteiro com um comando (macOS e Linux)

Na pasta principal do projeto:

```bash
./dev.sh
```

O script liga a API e o site e abre o navegador em `https://127.0.0.1:5173`. Ctrl+C desliga os dois.

Na primeira vez ele também prepara tudo sozinho: cria o `.venv`, instala as dependências do Python e do site, treina o modelo e gera o certificado HTTPS local (o login do Spotify exige HTTPS). Como o certificado é gerado no próprio computador, o navegador pede uma confirmação na primeira visita (Avançado → Continuar).

Para o aviso não aparecer nunca mais, em nenhum navegador, instale o [mkcert](https://github.com/FiloSottile/mkcert) uma vez. Ele cria uma autoridade de certificados só sua, em que o computador passa a confiar (o `mkcert -install` pede a senha do computador):

```bash
brew install mkcert
mkcert -install
```

Com o mkcert instalado, o `./dev.sh` gera o certificado por ele automaticamente.

Para usar o Spotify Premium dentro do site, coloque o Client ID do seu app em `frontend/.env.local` (o script cria esse arquivo a partir do `frontend/.env.example`). Sem ele, a prévia de 30 segundos continua funcionando.

### Opção 2: passo a passo (Windows ou sem o `dev.sh`)

Requisitos: Python 3.9 ou mais novo e Node.js 20 ou mais novo.

1. Clone o repositório e entre na pasta:

   ```bash
   git clone https://github.com/Luc7s/Sistemas-de-recomendacao.git
   cd Sistemas-de-recomendacao
   ```

2. Crie o ambiente Python e instale as dependências:

   ```bash
   python -m venv .venv
   source .venv/bin/activate        # no Windows: .venv\Scripts\activate
   python -m pip install -r requirements.txt
   ```

3. Gere o modelo (cerca de 1 minuto, só na primeira vez):

   ```bash
   python -m src.build_model
   ```

4. Ligue o site e a API juntos:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   O `npm run dev` liga também a API (com o Python do `.venv`), e o Ctrl+C desliga os dois. Se a API já estiver ligada na porta 8000, ele usa essa.

5. Abra `https://127.0.0.1:5173`. Sem certificados em `frontend/certs/`, o Vite gera um na hora e o navegador pede uma confirmação.

### Só o recomendador no terminal

Com as dependências instaladas, na pasta principal:

```bash
python src/main.py
```

O programa pede o nome da música e, se quiser, o artista. Depois mostra as recomendações dos dois métodos (cosseno e MMR) e salva os resultados em CSV na pasta `data/`.

### Avaliação e gráficos

```bash
python -m src.evaluate            # cerca de 3 minutos; resultados em reports/
python src/genre_analysis.py      # gráficos dos gêneros em outputs/ (precisa do Matplotlib)
```

O Matplotlib não está no `requirements.txt`, porque a API publicada não precisa dele. Para os gráficos: `python -m pip install matplotlib`.

## Publicação na internet

O site e a API são publicados juntos em um único serviço (Docker). O `Dockerfile` compila o front-end, treina o modelo a partir de `data/dataset.csv` e sobe a API, que também entrega as páginas do site.

### Banco de dados

No computador, as contas ficam em um arquivo SQLite (`instance/`). Na nuvem o disco é apagado a cada nova versão, então as contas ficam em um PostgreSQL, informado pela variável `DATABASE_URL`. O plano gratuito do [Neon](https://neon.tech) atende ao projeto.

### Render

1. Envie a branch para o GitHub.
2. No [Render](https://render.com), crie um **Blueprint** apontando para o repositório (ele lê o `render.yaml`), ou um **Web Service** com *Runtime: Docker* e plano *Free*.
3. Preencha as variáveis de ambiente:
   - `DATABASE_URL`: URL de conexão do PostgreSQL;
   - `SPOTIFY_CLIENT_ID`: Client ID do app no painel de desenvolvedor do Spotify.
4. No painel do Spotify, adicione em *Redirect URIs* o endereço do site seguido de `/callback`, por exemplo `https://echotrack.onrender.com/callback`.

No plano gratuito o serviço "dorme" depois de 15 minutos sem acesso, e o primeiro acesso seguinte leva cerca de um minuto.

### Domínio próprio

1. Registre o domínio (para `.com.br`, no [Registro.br](https://registro.br)).
2. No Render, em *Settings → Custom Domains*, adicione `www.echotrack.com.br`.
3. No DNS do domínio, crie um registro **CNAME** de `www` apontando para o endereço `.onrender.com` do serviço. O Render emite o certificado HTTPS automaticamente.
4. Adicione `https://www.echotrack.com.br/callback` nos *Redirect URIs* do Spotify.

## Próximas etapas

- Testes de usabilidade com usuários reais.
- Publicar o site em `www.echotrack.com.br`.
- Usar as respostas dos usuários cadastrados para calibrar o perfil musical.
