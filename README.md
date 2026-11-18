# Sistema de Recomendação de Músicas

Projeto de um sistema de recomendação musical utilizando um dataset do Spotify. O objetivo é recomendar músicas semelhantes a partir de uma música informada pelo usuário, considerando características musicais e gêneros.

## Tecnologias utilizadas

- Python
- Pandas
- NumPy
- Matplotlib
- Scikit-learn

## Funcionalidades implementadas

### 1. Carregamento dos dados
- Leitura do dataset em formato CSV.
- Carregamento centralizado pelo módulo `data_loader.py`.

### 2. Tratamento dos dados
- Remoção de valores nulos.
- Remoção de músicas com `track_id` duplicado.
- Remoção de registros duplicados.
- Filtragem de durações inválidas ou superiores a 20 minutos.
- Remoção de músicas com BPM inválido.
- Reinicialização dos índices.

### 3. Análise dos gêneros
- Contagem de músicas por gênero.
- Identificação da quantidade de gêneros.
- Geração de gráficos para analisar a distribuição dos dados.

### 4. Engenharia de características (Feature Engineering)
Preparação das características musicais para o algoritmo de recomendação:

- Aplicação de `log1p` em variáveis assimétricas.
- Padronização de características numéricas com `StandardScaler`.
- Codificação dos gêneros com One-hot Encoding.
- Transformação da tonalidade musical (`key`) utilizando seno e cosseno.
- Aplicação de peso nas características de gênero.

### 5. Sistema de recomendação

Foram implementados dois métodos:

**Baseline — Similaridade do Cosseno**

Compara a música escolhida com as demais músicas do dataset e retorna as mais semelhantes.

**MMR — Maximal Marginal Relevance**

Busca equilibrar relevância e diversidade, evitando recomendações excessivamente repetitivas.

### 6. EchoTrack: a aplicação

Interface web (React) e API (FastAPI) sobre o mesmo modelo. A recomendação é sempre
baseada no conteúdo (o som de cada faixa), e a interface mostra de onde cada
recomendação veio e por quê.

- **Explicação de cada recomendação:** afinidade (similaridade do cosseno), as 3
  características que mais aproximam a faixa da música de partida e se ela entrou
  por ser muito parecida ou "para variar" (escolha do MMR).
- **Rádio dirigível:** controles que puxam a playlist para mais (ou menos) energia,
  acústica e alegria, e um controle "parecido ↔ variado" que ajusta o λ do MMR.
  Cada controle desloca o vetor de partida em até 1,5 desvio-padrão na característica
  escolhida; o modelo não é retreinado.
- **Ponte entre duas músicas:** paradas ao longo da reta entre os vetores das duas
  músicas; em cada parada entra a faixa mais próxima, dentro dos estilos das duas pontas.
- **Fora da bolha:** dentro das músicas de som mais próximo, as menos populares
  sobem no ranking (o contrário do viés de popularidade).
- **Feito para você:** recomendações a partir do questionário, cada uma dizendo de
  qual gosto do perfil ela veio.

Principais rotas da API:

| Rota | O que faz |
| --- | --- |
| `GET /api/recommend/{track_id}` | Playlist a partir de uma música. Parâmetros: `n`, `lam`, `energy`, `acousticness`, `valence` (-1 a 1) e `obscure` |
| `GET /api/recommend/genre/{genre}` | Playlist pelo som médio de um gênero (`lam`, `obscure`) |
| `GET /api/bridge?from=&to=&n=` | Ponte entre duas músicas (`obscure`) |
| `GET /api/search?q=` | Busca por título e artista |
| `GET /api/artist?name=` | Músicas do artista e artistas de som parecido |
| `GET /api/me/for-you` | Recomendações do perfil (precisa de login) |

Cada resposta de recomendação traz `elapsed_ms`, o tempo que o modelo levou.

## Estrutura do projeto

```text
Sistemas-de-recomendacao/
│
├── data/
│   ├── dataset.csv
│   ├── feature_matrix.csv
│   ├── features.npy
│   ├── recommendations_baseline.csv
│   └── recommendations_mmr.csv
│
├── outputs/
│   ├── musicas_por_genero.png
│   └── histograma_generos.png
│
├── src/
│   ├── main.py
│   ├── data_loader.py
│   ├── data_types.py
│   ├── preprocessing.py
│   ├── features.py
│   ├── genre_analysis.py
│   └── recommender.py
│
├── requirements.txt
└── README.md
```

Os arquivos gerados durante a execução são recriados pelo programa e não precisam estar previamente disponíveis.

## Como executar o projeto

### Jeito rápido: o site inteiro com um comando (macOS e Linux)

Na pasta principal do projeto:

```bash
./dev.sh
```

O script liga a API e o site e abre o navegador em `https://127.0.0.1:5173`. Ctrl+C desliga os dois.

Na primeira vez ele também prepara tudo sozinho: cria o `.venv`, instala as dependências do Python e do site, treina o modelo e gera o certificado HTTPS local. Como o certificado é gerado no próprio computador, o navegador pede uma confirmação na primeira visita (Avançado → Continuar).

Para usar o Spotify Premium dentro do site, coloque o Client ID do seu app em `frontend/.env.local` (o script cria esse arquivo a partir do `frontend/.env.example`). Sem ele, a prévia de 30 segundos continua funcionando.

### Passo a passo: só o recomendador no terminal

### 1. Clonar o repositório

```bash
git clone https://github.com/Luc7s/Sistemas-de-recomendacao.git
```

### 2. Entrar na pasta

```bash
cd Sistemas-de-recomendacao
```

### 3. Instalar as dependências

```bash
python -m pip install -r requirements.txt
```

No Windows, caso necessário:

```bash
py -m pip install -r requirements.txt
```

### 4. Adicionar o dataset

Coloque o arquivo `dataset.csv` dentro da pasta `data/`.

O caminho esperado é:

```text
data/dataset.csv
```

### 5. Executar o projeto

Na pasta principal, execute:

```bash
python src/main.py
```

Ou, no Windows:

```bash
py src/main.py
```

### 6. Pesquisar uma música

O programa solicitará:

```text
Digite o nome da música:
Digite o artista (opcional):
```

Depois, serão exibidas as recomendações geradas pelos dois métodos:

- Baseline
- MMR

Os resultados também são salvos em arquivos CSV na pasta `data/`.

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

- Validar e comparar os resultados dos algoritmos.
- Avaliar a diversidade e a qualidade das recomendações.
- Usar as respostas dos usuários cadastrados para calibrar o perfil musical.

## Objetivo

Desenvolver um sistema de recomendação musical baseado em conteúdo (*Content-Based Filtering*), utilizando características das músicas para identificar similaridades e gerar recomendações.