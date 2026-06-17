import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Must be set before any app module is imported so get_settings() (lru_cached) picks them up.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_setup.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from pytest_postgresql import factories as pg_factories

from app.main import app as fastapi_app
from app.database import get_db
from app.models.base import Base

# Import all models so their tables are registered with Base.metadata.
# Note: these must come after `from app.main import app as fastapi_app` because
# `import app.models.*` would rebind the name `app` to the package, shadowing the FastAPI instance.
from app.models import user, player, season, group, assignment, group_target, measurement, training_session  # noqa: F401

import uuid
from datetime import date

from app.limiter import limiter as _rate_limiter
from app.models.season import Season
from app.models.group import Group as GroupModel
from app.models.player import Player

TEST_DB_URL = "sqlite:///./test_setup.db"
TEST_DB_URL_INT = "sqlite:///./test_integration.db"

_ADMIN = {"email": "admin@test.com", "password": "Admin123", "full_name": "Admin"}
_LOGIN = {"email": "admin@test.com", "password": "Admin123"}


@pytest.fixture
def client():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    yield TestClient(fastapi_app)
    fastapi_app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()
    if os.path.exists("./test_setup.db"):
        os.remove("./test_setup.db")


@pytest.fixture
def seeded():
    """Client with pre-seeded season, group, player and authenticated admin."""
    _rate_limiter.enabled = False
    engine = create_engine(TEST_DB_URL_INT, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    http = TestClient(fastapi_app)

    # Seed: season + group + player via DB (no season API exists)
    season = Season(id=uuid.uuid4(), name="Stagione Test", is_current=True,
                    start_date=date(2025, 9, 1), end_date=date(2026, 6, 30))
    db.add(season)
    group = GroupModel(id=uuid.uuid4(), season_id=season.id, name="Under 15",
                       category="Agonistica", level="A", birth_year=2010)
    db.add(group)
    player = Player(id=uuid.uuid4(), first_name="Mario", last_name="Rossi",
                    birth_year=2010, is_active=True)
    db.add(player)
    db.commit()

    # Auth
    http.post("/api/auth/setup", json=_ADMIN)
    token = http.post("/api/auth/login", json=_LOGIN).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    yield {
        "client": http,
        "headers": headers,
        "season_id": str(season.id),
        "group_id": str(group.id),
        "player_id": str(player.id),
    }

    db.close()
    _rate_limiter.enabled = True
    fastapi_app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()
    if os.path.exists("./test_integration.db"):
        os.remove("./test_integration.db")


# ── PostgreSQL fixtures (require pg_ctl in PATH) ──────────────────────────────
# Se pg_ctl non è disponibile, i test che dipendono da questi fixture vengono
# auto-skippati da pytest-postgresql con un messaggio esplicito.

postgresql15_proc = pg_factories.postgresql_proc()
postgresql15_conn = pg_factories.postgresql("postgresql15_proc")


@pytest.fixture
def pg_seeded(postgresql15_conn):
    """Come `seeded` ma con PostgreSQL reale — abilita test che usano ON CONFLICT."""
    _rate_limiter.enabled = False

    info = postgresql15_conn.info
    pw = f":{info.password}" if info.password else ""
    dsn = f"postgresql+psycopg2://{info.user}{pw}@{info.host}:{info.port}/{info.dbname}"

    engine = create_engine(dsn)
    Base.metadata.create_all(engine)
    PGSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = PGSession()

    def override_get_db():
        s = PGSession()
        try:
            yield s
        finally:
            s.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    http = TestClient(fastapi_app)

    season = Season(id=uuid.uuid4(), name="Stagione PG Test", is_current=True,
                    start_date=date(2025, 9, 1), end_date=date(2026, 6, 30))
    db.add(season)
    group = GroupModel(id=uuid.uuid4(), season_id=season.id, name="Under 15",
                       category="Agonistica", level="A", birth_year=2010)
    db.add(group)
    players = [
        Player(id=uuid.uuid4(), first_name="Mario", last_name="Rossi",
               birth_year=2010, is_active=True),
        Player(id=uuid.uuid4(), first_name="Luigi", last_name="Bianchi",
               birth_year=2010, is_active=True),
    ]
    for p in players:
        db.add(p)
    db.commit()

    http.post("/api/auth/setup", json=_ADMIN)
    token = http.post("/api/auth/login", json=_LOGIN).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    yield {
        "client": http,
        "headers": headers,
        "group_id": str(group.id),
        "player_ids": [str(p.id) for p in players],
    }

    db.close()
    _rate_limiter.enabled = True
    fastapi_app.dependency_overrides.clear()
    engine.dispose()
    # Il DatabaseJanitor di pytest-postgresql elimina l'intero database — nessun drop manuale necessario
