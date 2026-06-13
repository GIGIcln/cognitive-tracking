from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Cognitive Tracking API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers verranno registrati qui
# from app.routers import auth, patients, sessions
# app.include_router(auth.router, prefix="/api/auth", tags=["auth"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "env": settings.app_env}
