#!/usr/bin/env bash
# Sobe o EchoTrack inteiro (API + site) com um comando só.
#
#   ./dev.sh
#
# Na primeira vez ele também instala as dependências, treina o modelo e
# gera o certificado HTTPS local. Ctrl+C desliga tudo.

set -e
cd "$(dirname "$0")"

API_PORT=8000
WEB_PORT=5173
API_PID=""

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

# 1. Libera as portas (sobra de uma execução anterior, por exemplo).
for port in $API_PORT $WEB_PORT; do
  pids=$(lsof -ti tcp:$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    step "Fechando o que estava usando a porta $port"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
done

# 2. Python: cria o .venv e instala as dependências quando o requirements.txt muda.
if [ ! -x .venv/bin/python ]; then
  step "Criando o ambiente Python (.venv)"
  python3 -m venv .venv
fi
if [ ! -f .venv/.instalado ] || [ requirements.txt -nt .venv/.instalado ]; then
  step "Instalando as dependências do Python"
  .venv/bin/python -m pip install -q --upgrade pip
  .venv/bin/python -m pip install -q -r requirements.txt
  touch .venv/.instalado
fi

# 3. Modelo: treina a partir do data/dataset.csv se ainda não existir.
if [ ! -f models/feature_matrix.npy ]; then
  step "Treinando o modelo (só na primeira vez)"
  .venv/bin/python -m src.build_model
fi

# 4. Front-end: instala os pacotes quando o package-lock.json muda.
if [ ! -f frontend/node_modules/.package-lock.json ] || [ frontend/package-lock.json -nt frontend/node_modules/.package-lock.json ]; then
  step "Instalando as dependências do site (npm)"
  (cd frontend && npm install --no-audit --no-fund)
fi

# 5. Certificado HTTPS local (o login do Spotify exige https).
#    Com o mkcert instalado (brew install mkcert && mkcert -install), o
#    certificado sai de uma autoridade local em que o Mac já confia: nenhum
#    navegador avisa. Sem ele, cai para um certificado do openssl, que o
#    navegador pede para confirmar.
CERT=frontend/certs/cert.pem
KEY=frontend/certs/key.pem
cert_info() { openssl x509 -in "$CERT" -noout -text 2>/dev/null; }
if command -v mkcert >/dev/null 2>&1; then
  if [ ! -f "$CERT" ] || [ ! -f "$KEY" ] || ! cert_info | grep -q "Issuer:.*mkcert"; then
    step "Gerando o certificado HTTPS local (mkcert)"
    mkdir -p frontend/certs
    mkcert -cert-file "$CERT" -key-file "$KEY" 127.0.0.1 localhost ::1 >/dev/null 2>&1
  fi
elif [ ! -f "$CERT" ] || [ ! -f "$KEY" ] || ! cert_info | grep -q "TLS Web Server Authentication"; then
  # O Safari só aceita certificado de servidor com "serverAuth" e sem CA:TRUE.
  step "Gerando o certificado HTTPS local (openssl)"
  mkdir -p frontend/certs
  openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
    -subj "/CN=EchoTrack local" \
    -addext "subjectAltName=IP:127.0.0.1,DNS:localhost" \
    -addext "basicConstraints=critical,CA:FALSE" \
    -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
    -addext "extendedKeyUsage=serverAuth" \
    -keyout "$KEY" -out "$CERT" 2>/dev/null
  echo "Dica: instale o mkcert (veja o README) para o navegador nunca mais avisar."
fi

# 6. Client ID do Spotify (opcional: sem ele, a prévia de 30 s continua funcionando).
if [ ! -f frontend/.env.local ]; then
  cp frontend/.env.example frontend/.env.local
  echo "Aviso: crie o app no Spotify Developer e coloque o Client ID em frontend/.env.local."
fi

# 7. API em segundo plano; é desligada junto com o site.
cleanup() {
  if [ -n "$API_PID" ]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 0' INT TERM

step "Ligando a API"
.venv/bin/python -m uvicorn app.main:app --reload --port $API_PORT --log-level warning &
API_PID=$!

printf "Carregando o modelo"
for _ in $(seq 1 120); do
  if curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1; then
    printf " pronto.\n"
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    printf "\nA API não subiu. Veja o erro acima.\n"
    exit 1
  fi
  printf "."
  sleep 0.5
done

# 8. Site em primeiro plano; abre o navegador sozinho.
step "Ligando o site em https://127.0.0.1:$WEB_PORT  (Ctrl+C desliga tudo)"
cd frontend
npx vite --open
