import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import user_store
from app.config import get_settings
from app.database import get_db
from app.limiter import limiter
from app.routers import auth, groups, players, seasons, sessions

logger = logging.getLogger(__name__)

settings = get_settings()

_docs_enabled = settings.app_env == "development"


@asynccontextmanager
async def lifespan(_: FastAPI):
    user_store._load()  # fail fast se users.json è mancante o malformato
    yield


app = FastAPI(
    title="Cognitive Tracking API",
    version="1.0.0",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    logger.warning("IntegrityError on %s %s: %s", request.method, request.url.path, exc.orig)
    return JSONResponse(
        status_code=409,
        content={"detail": "Risorsa già esistente o vincolo di integrità violato."},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Errore interno del server."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    # La regex trycloudflare è attiva solo in development per il tunneling locale.
    # In production qualsiasi origine deve essere elencata esplicitamente in ALLOWED_ORIGINS.
    allow_origin_regex=r"https://.*\.trycloudflare\.com" if settings.app_env == "development" else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(seasons.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(players.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return {"status": "unhealthy", "database": "disconnected"}
