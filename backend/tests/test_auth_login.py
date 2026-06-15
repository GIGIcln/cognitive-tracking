SETUP_BODY = {
    "email": "admin@test.com",
    "password": "Admin123",
    "full_name": "Admin User",
}

LOGIN_BODY = {
    "email": "admin@test.com",
    "password": "Admin123",
}


def _setup_and_login(client):
    client.post("/api/auth/setup", json=SETUP_BODY)
    res = client.post("/api/auth/login", json=LOGIN_BODY)
    return res.json()["access_token"]


def test_login_valid_credentials_returns_200(client):
    client.post("/api/auth/setup", json=SETUP_BODY)
    res = client.post("/api/auth/login", json=LOGIN_BODY)
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["email"] == "admin@test.com"


def test_login_wrong_password_returns_401(client):
    client.post("/api/auth/setup", json=SETUP_BODY)
    res = client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": "WrongPass1",
    })
    assert res.status_code == 401
    assert "Credenziali non valide" in res.json()["detail"]


def test_login_nonexistent_email_returns_401(client):
    res = client.post("/api/auth/login", json={
        "email": "ghost@test.com",
        "password": "Admin123",
    })
    assert res.status_code == 401
    # Same message as wrong password — does not reveal whether the email exists.
    assert "Credenziali non valide" in res.json()["detail"]


def test_me_with_valid_token_returns_user(client):
    token = _setup_and_login(client)
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    assert data["email"] == "admin@test.com"
    assert "full_name" in data
    assert "is_active" in data


def test_me_without_token_returns_401(client):
    # This version of FastAPI/Starlette raises 401 when the Authorization header is absent.
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_with_invalid_token_returns_401(client):
    # A syntactically valid Bearer header with a bad JWT triggers JWTError → 401.
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer tokenfalso"})
    assert res.status_code == 401
