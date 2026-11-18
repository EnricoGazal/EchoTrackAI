
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.state import state
from app.router import router
from app.accounts import router as accounts_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Carregando modelo...")
    state.load()
    print("API pronta!")

    yield


app = FastAPI(
    title="EchoTrack API",
    description=(
        "API de recomendação musical utilizando "
        "similaridade do cosseno e MMR."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/config")
def public_config():
    """Configuração pública para o front-end (o Client ID do Spotify não é segredo)."""
    return {"spotify_client_id": os.environ.get("SPOTIFY_CLIENT_ID", "")}


app.include_router(router, prefix="/api")
app.include_router(accounts_router, prefix="/api")


# Em produção, a própria API entrega o site (frontend/dist), no mesmo endereço.
# No computador, o site continua vindo do "npm run dev".
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def site(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Rota não encontrada.")
        file = (DIST / path).resolve()
        if path and file.is_file() and DIST in file.parents:
            return FileResponse(file)
        # Rotas do app (como /callback do login do Spotify) abrem o index.html.
        return FileResponse(DIST / "index.html")
else:

    @app.get("/")
    def root():
        return {
            "message": "EchoTrack API",
            "status": "online",
            "documentation": "/docs",
        }
