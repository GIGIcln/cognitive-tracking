"""Tests per il flusso di login con user_store file-based."""

_LOGIN = {"email": "admin@test.com", "password": "Admin123"}
_COACH_LOGIN = {"email": "coach@test.com", "password": "Admin123"}
_RESP_LOGIN = {"email": "responsabile@test.com", "password": "Admin123"}


def _login(client, credentials=_LOGIN) -> str:
    return client.post("/api/auth/login", json=credentials).json()["access_token"]


def test_login_valid_credentials_returns_200(client):
    res = client.post("/api/auth/login", json=_LOGIN)
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["email"] == "admin@test.com"


def test_login_returns_roles_in_user(client):
    res = client.post("/api/auth/login", json=_LOGIN)
    assert res.status_code == 200
    assert "admin" in res.json()["user"]["roles"]


def test_login_wrong_password_returns_401(client):
    res = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "WrongPass1"})
    assert res.status_code == 401
    assert "Credenziali non valide" in res.json()["detail"]


def test_login_nonexistent_email_returns_401(client):
    res = client.post("/api/auth/login", json={"email": "ghost@test.com", "password": "Admin123"})
    assert res.status_code == 401
    assert "Credenziali non valide" in res.json()["detail"]


def test_me_with_valid_token_returns_user(client):
    token = _login(client)
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "admin@test.com"
    assert "roles" in data
    assert "admin" in data["roles"]


def test_me_without_token_returns_401(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_with_invalid_token_returns_401(client):
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer tokenfalso"})
    assert res.status_code == 401


def test_coach_login_returns_allenatore_role(client):
    res = client.post("/api/auth/login", json=_COACH_LOGIN)
    assert res.status_code == 200
    assert "allenatore" in res.json()["user"]["roles"]


def test_responsabile_login_returns_correct_role(client):
    res = client.post("/api/auth/login", json=_RESP_LOGIN)
    assert res.status_code == 200
    assert "responsabile_tecnico" in res.json()["user"]["roles"]
