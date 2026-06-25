import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Must be set before any app module is imported so get_settings() (lru_cached) picks them up.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_setup.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("ALLOW_MANUAL_SCORES", "true")  # test esistenti usano POST /measurements

import uuid
from datetime import date

import bcrypt as _bcrypt
import pytest
from fastapi.testclient import TestClient
from pytest_postgresql import factories as pg_factories
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.limiter import limiter as _rate_limiter
from app.main import app as fastapi_app
from app.models.base import Base
from app.models import user, player, season, group, assignment, group_target, measurement, training_session, injury_log  # noqa: F401
from app.models.group import Group as GroupModel
from app.models.player import Player
from app.models.season import Season
from app.models.user import User

TEST_DB_URL = "sqlite:///./test_setup.db"
TEST_DB_URL_INT = "sqlite:///./test_integration.db"

# Pre-compute bcrypt hash once per process (rounds=4 for test speed vs. rounds=12 in prod)
_TEST_PASSWORD = "Admin123"
_TEST_HASH = _bcrypt.hashpw(_TEST_PASSWORD.encode(), _bcrypt.gensalt(rounds=4)).decode()

_LOGIN = {"email": "admin@test.com", "password": _TEST_PASSWORD}

# ── Utenti di test ─────────────────────────────────────────────────────────
ADMIN_ID = "a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5"
COACH_ID = "f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5"
RESP_ID  = "c1c1c1c1-d2d2-e3e3-f4f4-a5a5a5a5a5a5"

_TEST_ADMIN = {
    "id": ADMIN_ID,
    "email": "admin@test.com",
    "full_name": "Admin Test",
    "hashed_password": _TEST_HASH,
    "is_active": True,
    "roles": ["admin"],
    "assigned_group_ids": [],
}

# assigned_group_ids del coach viene aggiornato dinamicamente in seeded/pg_seeded.
_TEST_COACH: dict = {
    "id": COACH_ID,
    "email": "coach@test.com",
    "full_name": "Coach Test",
    "hashed_password": _TEST_HASH,
    "is_active": True,
    "roles": ["allenatore"],
    "assigned_group_ids": [],
}

_TEST_RESP = {
    "id": RESP_ID,
    "email": "responsabile@test.com",
    "full_name": "Responsabile Test",
    "hashed_password": _TEST_HASH,
    "is_active": True,
    "roles": ["responsabile_tecnico"],
    "assigned_group_ids": [],
}

_ALL_TEST_USERS = [_TEST_ADMIN, _TEST_COACH, _TEST_RESP]


def _seed_users(db, users: list = _ALL_TEST_USERS) -> None:
    """Crea utenti nel DB per i test."""
    for u in users:
        db.add(User(
            id=uuid.UUID(u["id"]),
            email=u["email"],
            full_name=u.get("full_name"),
            hashed_password=u["hashed_password"],
            is_active=u.get("is_active", True),
            roles=list(u.get("roles", [])),
            assigned_group_ids=list(u.get("assigned_group_ids", [])),
        ))
    db.commit()


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    _rate_limiter.enabled = False

    db = TestingSessionLocal()
    _seed_users(db)
    db.close()

    yield TestClient(fastapi_app)

    _rate_limiter.enabled = True
    fastapi_app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()
    if os.path.exists("./test_setup.db"):
        os.remove("./test_setup.db")


@pytest.fixture
def seeded():
    """Client con stagione, gruppo e giocatore pre-seeded e admin autenticato."""
    _rate_limiter.enabled = False
    engine = create_engine(TEST_DB_URL_INT, connect_args={"check_same_thread": False})
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db

    db = TestingSessionLocal()
    season_obj = Season(id=uuid.uuid4(), name="Stagione Test", is_current=True,
                        start_date=date(2025, 9, 1), end_date=date(2026, 6, 30))
    db.add(season_obj)
    grp = GroupModel(id=uuid.uuid4(), season_id=season_obj.id, name="Under 15",
                     category="Agonistica", level="A", birth_year=2010)
    db.add(grp)
    plr = Player(id=uuid.uuid4(), first_name="Mario", last_name="Rossi",
                 birth_year=2010, is_active=True)
    db.add(plr)
    db.commit()

    _TEST_COACH["assigned_group_ids"] = [str(grp.id)]
    _seed_users(db)

    http = TestClient(fastapi_app)
    token = http.post("/api/auth/login", json=_LOGIN).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    anon = TestClient(fastapi_app)

    yield {
        "client": http,
        "anon_client": anon,
        "headers": headers,
        "season_id": str(season_obj.id),
        "group_id": str(grp.id),
        "player_id": str(plr.id),
    }

    db.close()
    _rate_limiter.enabled = True
    _TEST_COACH["assigned_group_ids"] = []
    fastapi_app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()
    if os.path.exists("./test_integration.db"):
        os.remove("./test_integration.db")


# ── PostgreSQL fixtures (require pg_ctl in PATH) ─────────────────────────────
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

    def override_get_db():
        s = PGSession()
        try:
            yield s
        finally:
            s.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db

    db = PGSession()
    season_obj = Season(id=uuid.uuid4(), name="Stagione PG Test", is_current=True,
                        start_date=date(2025, 9, 1), end_date=date(2026, 6, 30))
    db.add(season_obj)
    grp = GroupModel(id=uuid.uuid4(), season_id=season_obj.id, name="Under 15",
                     category="Agonistica", level="A", birth_year=2010)
    db.add(grp)
    players = [
        Player(id=uuid.uuid4(), first_name="Mario", last_name="Rossi",
               birth_year=2010, is_active=True),
        Player(id=uuid.uuid4(), first_name="Luigi", last_name="Bianchi",
               birth_year=2010, is_active=True),
    ]
    for p in players:
        db.add(p)
    db.commit()

    _TEST_COACH["assigned_group_ids"] = [str(grp.id)]
    _seed_users(db)

    http = TestClient(fastapi_app)
    token = http.post("/api/auth/login", json=_LOGIN).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    yield {
        "client": http,
        "headers": headers,
        "group_id": str(grp.id),
        "player_ids": [str(p.id) for p in players],
    }

    db.close()
    _rate_limiter.enabled = True
    _TEST_COACH["assigned_group_ids"] = []
    fastapi_app.dependency_overrides.clear()
    engine.dispose()
