# Imagem única do EchoTrack: compila o front-end, treina o modelo e
# sobe a API, que também entrega o site.

# 1. Front-end (React + Vite)
FROM node:20-slim AS front
WORKDIR /front
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npx vite build

# 2. API (FastAPI) + modelo
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY src ./src
COPY data/dataset.csv ./data/dataset.csv

# O treino roda na construção da imagem, então o servidor já sobe com o modelo pronto.
RUN python -m src.build_model

COPY --from=front /front/dist ./frontend/dist

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
