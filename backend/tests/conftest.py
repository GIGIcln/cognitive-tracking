import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_setup.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("ALLOW_MANUAL_SCORES", "true")

import uuid
from datetime import date

import bcrypt as _bcrypt
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from pytest_postgresql import factories as pg_factories
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.database import get_db
from app.limiter import limiter as _rate_limiter
from app.main import app as fastapi_app
from app.models.base import Base
from app.models import user, player, season, group, assignment, group_target, measurement, training_session, injury_log  # noqa: F401
from app.models.group import Group as GroupModel
from app.models.player import Player
from app.models.season import Season
from app.models.user import User

TEST_ASYNC_DB_URL = "sqlite+aiosqlite:///./test_setup.db"
TEST_ASYNC_DB_URL_INT = "sqlite+aiosqlite:///./test_integration.db"

_TEST_PASSWORD = "Admin123"
_TEST_HASH = _bcrypt.hashpw(_TEST_PASSWORD.encode(), _bcrypt.gensalt(rounds=4)).decode()

_LOGIN = {"email": "admin@test.com", "password": _TEST_PASSWORD}

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


async def _seed_users(session: AsyncSession, users: list = _ALL_TEST_USERS) -> None:
    for u in users:
        session.add(User(
            id=uuid.UUID(u["id"]),
            email=u["email"],
            full_name=u.get("full_name"),
            hashed_password=u["hashed_password"],
            is_active=u.get("is_active", True),
            roles=list(u.get("roles", [])),
            assigned_group_ids=list(u.get("assigned_group_ids", [])),
        ))
    await session.commit()


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client():
    engine = create_async_engine(TEST_ASYNC_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    AsyncTestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with AsyncTestSession() as session:
            yield session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    _rate_limiter.enabled = False

    async with AsyncTestSession() as session:
        await _seed_users(session)

    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://testserver") as http:
        yield http

    _rate_limiter.enabled = True
    fastapi_app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    if os.path.exists("./test_setup.db"):
        os.remove("./test_setup.db")


@pytest_asyncio.fixture
async def seeded():
    """Client con stagione, gruppo e giocatore pre-seeded e admin autenticato."""
    _rate_limiter.enabled = False
    engine = create_async_engine(TEST_ASYNC_DB_URL_INT)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    AsyncTestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with AsyncTestSession() as session:
            yield session

    fastapi_app.dependency_overrides[get_db] = override_get_db

    season_id: str
    group_id: str
    player_id: str

    async with AsyncTestSession() as session:
        season_obj = Season(
            id=uuid.uuid4(), name="Stagione Test", is_current=True,
            start_date=date(2025, 9, 1), end_date=date(2026, 6, 30),
        )
        session.add(season_obj)
        grp = GroupModel(
            id=uuid.uuid4(), season_id=season_obj.id, name="Under 15",
            category="Agonistica", level="A", birth_year=2010,
        )
        session.add(grp)
        plr = Player(id=uuid.uuid4(), first_name="Mario", last_name="Rossi",
                     birth_year=2010, is_active=True)
        session.add(plr)
        await session.commit()

        _TEST_COACH["assigned_group_ids"] = [str(grp.id)]
        await _seed_users(session)

        season_id = str(season_obj.id)
        group_id = str(grp.id)
        player_id = str(plr.id)

    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://testserver") as http:
        login_resp = await http.post("/api/auth/login", json=_LOGIN)
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        anon = AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://testserver")

        yield {
            "client": http,
            "anon_client": anon,
            "headers": headers,
            "season_id": season_id,
            "group_id": group_id,
            "player_id": player_id,
        }

        await anon.aclose()

    _rate_limiter.enabled = True
    _TEST_COACH["assigned_group_ids"] = []
    fastapi_app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    if os.path.exists("./test_integration.db"):
        os.remove("./test_integration.db")


# ── PostgreSQL fixtures ───────────────────────────────────────────────────────

postgresql15_proc = pg_factories.postgresql_proc()
postgresql15_conn = pg_factories.postgresql("postgresql15_proc")


@pytest_asyncio.fixture
async def pg_seeded(postgresql15_conn):
    """Come `seeded` ma con PostgreSQL reale — abilita test che usano ON CONFLICT."""
    _rate_limiter.enabled = False

    info = postgresql15_conn.info
    pw = f":{info.password}" if info.password else ""
    dsn = f"postgresql+asyncpg://{info.user}{pw}@{info.host}:{info.port}/{info.dbname}"

    engine = create_async_engine(dsn)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncPGSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with AsyncPGSession() as session:
            yield session

    fastapi_app.dependency_overrides[get_db] = override_get_db

    group_id: str
    player_ids: list[str]

    async with AsyncPGSession() as session:
        season_obj = Season(
            id=uuid.uuid4(), name="Stagione PG Test", is_current=True,
            start_date=date(2025, 9, 1), end_date=date(2026, 6, 30),
        )
        session.add(season_obj)
        grp = GroupModel(
            id=uuid.uuid4(), season_id=season_obj.id, name="Under 15",
            category="Agonistica", level="A", birth_year=2010,
        )
        session.add(grp)
        players = [
            Player(id=uuid.uuid4(), first_name="Mario", last_name="Rossi",
                   birth_year=2010, is_active=True),
            Player(id=uuid.uuid4(), first_name="Luigi", last_name="Bianchi",
                   birth_year=2010, is_active=True),
        ]
        for p in players:
            session.add(p)
        await session.commit()

        _TEST_COACH["assigned_group_ids"] = [str(grp.id)]
        await _seed_users(session)

        group_id = str(grp.id)
        player_ids = [str(p.id) for p in players]

    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://testserver") as http:
        login_resp = await http.post("/api/auth/login", json=_LOGIN)
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        yield {
            "client": http,
            "headers": headers,
            "group_id": group_id,
            "player_ids": player_ids,
        }

    _rate_limiter.enabled = True
    _TEST_COACH["assigned_group_ids"] = []
    fastapi_app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
