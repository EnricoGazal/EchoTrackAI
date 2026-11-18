# Front-end do Recomendador de Músicas

Interface em React + Vite que consome a API FastAPI do projeto.

## Como rodar

São dois terminais, ambos a partir da raiz do repositório.

Terminal 1 (API):

```bash
python -m src.build_model        # só na primeira vez, gera a pasta models/
uvicorn app.main:app --reload    # API em http://127.0.0.1:8000
```

Terminal 2 (front-end):

```bash
cd frontend
npm install                      # só na primeira vez
npm run dev                      # abre em http://localhost:5173
```

Abra **https://127.0.0.1:5173** (o Vite repassa as chamadas `/api/...` para a porta 8000).

## HTTPS

O front roda em **https://127.0.0.1:5173**. Sem configurar nada, o Vite cria um
certificado próprio e o navegador mostra um aviso na primeira visita
(clique em "Mostrar detalhes" e "visitar este site" no Safari, ou "Avançado" e
"Continuar" no Chrome).

Para ter o cadeado sem aviso, gere um certificado confiável com o mkcert (uma vez por computador):

```bash
brew install mkcert
mkcert -install          # pede a senha do Mac para confiar no certificado local
cd frontend
mkdir -p certs
mkcert -key-file certs/key.pem -cert-file certs/cert.pem 127.0.0.1 localhost
```

Depois reinicie o `npm run dev`. A pasta `certs/` não vai para o Git.

## Músicas inteiras com Spotify Premium (opcional)

Sem configurar nada, o player toca a prévia de 30 segundos do Spotify. Para tocar
as músicas inteiras dentro do EchoTrack, é preciso uma conta **Spotify Premium**:

1. Entre em https://developer.spotify.com/dashboard com a conta Premium e clique em **Create app**.
2. Preencha nome e descrição, coloque o Redirect URI `https://127.0.0.1:5173/callback`
   (o Spotify não aceita `localhost`) e marque **Web API** e **Web Playback SDK**.
3. Em **Settings**, copie o **Client ID**.
4. Em **User Management**, adicione o nome e o e-mail da conta Spotify de cada pessoa
   que vai usar (até 5 no modo de desenvolvimento).
5. Na pasta `frontend/`, copie `.env.example` para `.env.local` e cole o Client ID:
   `VITE_SPOTIFY_CLIENT_ID=seu_client_id`
6. Reinicie o `npm run dev`, abra o EchoTrack e use **Conectar Spotify Premium** no menu da conta.

O login usa o fluxo PKCE, então não há chave secreta no projeto. O Client ID fica
em `.env.local`, que não vai para o Git.

## Sistema visual

Todo o visual sai de tokens em `src/design/tokens.css` (cores em OKLCH, tipografia,
espaçamento, raio, sombras e movimento). O Tailwind v4 (`src/design/theme.css`) só
enxerga esses tokens: a paleta padrão do Tailwind está desligada, então nenhum
componente usa cor, fonte ou espaçamento fora deles.

- **Cores:** grafite com um fio de ameixa; âmbar para ações (tocar, ponto de reprodução);
  ciano exclusivo para tudo que vem do modelo (a "camada IA"). Contraste AA medido.
- **Fontes:** Bricolage Grotesque (títulos, largura condensada) e Geist (texto),
  hospedadas no próprio projeto via Fontsource.
- **Componentes:** padrão shadcn/ui (Radix + Tailwind + CVA) em `src/ui/`.
- **Movimento:** Motion, sempre respeitando "reduzir movimento" do sistema.

## Estrutura

```text
frontend/src/
├── main.jsx, App.jsx           # entrada, login/questionário e o app (rotas, player, busca)
├── api.js                      # chamadas à API, com cache das respostas do modelo
├── spotify.js                  # login no Spotify e Web Playback SDK
├── design/                     # tokens e tema do Tailwind
├── lib/                        # rotas, biblioteca local, utilitários
├── ui/                         # componentes base (botão, selo, slider, painel, busca…)
├── features/
│   ├── ai/                     # camada IA: origem, afinidade, MMR e "Por que essa?"
│   ├── radio/                  # rádio dirigível (controles e lista que se refaz)
│   ├── tracks/                 # lista de faixas e cartões
│   ├── player/                 # motores (prévia e Premium) e barra do player
│   ├── now-playing/            # tela cheia: forma de onda, tempo, capa ao fundo
│   └── shell/                  # menu lateral, navegação no celular, busca ⌘K
└── pages/                      # Início, Descobrir (Ponte), Playlist, Gênero, Artista,
                                # Perfil, Biblioteca, Login e Questionário
```

## Decisões que reduzem a espera

- A API responde a playlist em poucos milissegundos (matriz já normalizada e MMR vetorizado).
- Respostas do modelo ficam em cache no navegador e no servidor: voltar a uma posição
  dos controles é imediato.
- Passar o mouse sobre uma música já pré-carrega a playlist dela.
- Enquanto os controles do rádio mudam, a lista antiga continua na tela e só as
  músicas que mudaram entram com animação.
- O rádio que continua a fila é pré-carregado quando a última música começa.
