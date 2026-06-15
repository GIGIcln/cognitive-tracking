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

from app.main import app as fastapi_app
from app.database import get_db
from app.models.base import Base

# Import all models so their tables are registered with Base.metadata.
# Note: these must come after `from app.main import app as fastapi_app` because
# `import app.models.*` would rebind the name `app` to the package, shadowing the FastAPI instance.
from app.models import user, player, season, group, assignment, group_target, measurement, training_session  # noqa: F401

TEST_DB_URL = "sqlite:///./test_setup.db"


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
