"""
Test per /auth/register e /api/users CRUD (GS-01/GS-02).
"""
import uuid

_ADMIN_LOGIN = {"email": "admin@test.com", "password": "Admin123"}
_COACH_LOGIN = {"email": "coach@test.com", "password": "Admin123"}

_NEW_USER = {
    "email": "nuovo@test.com",
    "password": "Sicuro123!",
    "full_name": "Nuovo Allenatore",
}


def _admin_headers(client) -> dict:
    token = client.post("/api/auth/login", json=_ADMIN_LOGIN).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _coach_headers(client) -> dict:
    token = client.post("/api/auth/login", json=_COACH_LOGIN).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── /auth/register ────────────────────────────────────────────────────────────

def test_register_creates_pending_allenatore(client):
    res = client.post("/api/auth/register", json=_NEW_USER)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == _NEW_USER["email"]
    assert data["status"] == "pending"
    assert data["roles"] == ["allenatore"]
    assert data["is_active"] is False


def test_register_duplicate_email_returns_409(client):
    client.post("/api/auth/register", json=_NEW_USER)
    res = client.post("/api/auth/register", json=_NEW_USER)
    assert res.status_code == 409


def test_pending_user_cannot_login(client):
    client.post("/api/auth/register", json=_NEW_USER)
    res = client.post("/api/auth/login", json={
        "email": _NEW_USER["email"],
        "password": _NEW_USER["password"],
    })
    assert res.status_code == 401


# ── GET /api/users ────────────────────────────────────────────────────────────

def test_admin_can_list_users(client):
    res = client.get("/api/users", headers=_admin_headers(client))
    assert res.status_code == 200
    emails = [u["email"] for u in res.json()]
    assert "admin@test.com" in emails


def test_coach_cannot_list_users(client):
    res = client.get("/api/users", headers=_coach_headers(client))
    assert res.status_code == 403


def test_unauthenticated_cannot_list_users(client):
    assert client.get("/api/users").status_code == 401


# ── PATCH /api/users/{id} ─────────────────────────────────────────────────────

def _get_coach_id(client, admin_h) -> str:
    users = client.get("/api/users", headers=admin_h).json()
    return next(u["id"] for u in users if u["email"] == "coach@test.com")


def test_admin_can_activate_pending_user(client):
    client.post("/api/auth/register", json=_NEW_USER)
    admin_h = _admin_headers(client)
    users = client.get("/api/users", headers=admin_h).json()
    new_id = next(u["id"] for u in users if u["email"] == _NEW_USER["email"])

    res = client.patch(f"/api/users/{new_id}", headers=admin_h, json={"status": "active"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "active"
    assert data["is_active"] is True


def test_admin_can_change_roles(client):
    admin_h = _admin_headers(client)
    coach_id = _get_coach_id(client, admin_h)

    res = client.patch(f"/api/users/{coach_id}", headers=admin_h,
                       json={"roles": ["allenatore", "responsabile_tecnico"]})
    assert res.status_code == 200
    assert set(res.json()["roles"]) == {"allenatore", "responsabile_tecnico"}


def test_coach_cannot_patch_user(client):
    admin_h = _admin_headers(client)
    coach_id = _get_coach_id(client, admin_h)
    res = client.patch(f"/api/users/{coach_id}", headers=_coach_headers(client),
                       json={"status": "suspended"})
    assert res.status_code == 403


# ── DELETE /api/users/{id} ────────────────────────────────────────────────────

def test_admin_cannot_delete_self(client):
    admin_h = _admin_headers(client)
    admin_id = next(
        u["id"] for u in client.get("/api/users", headers=admin_h).json()
        if u["email"] == "admin@test.com"
    )
    res = client.delete(f"/api/users/{admin_id}", headers=admin_h)
    assert res.status_code == 400


def test_delete_nonexistent_user_returns_404(client):
    admin_h = _admin_headers(client)
    res = client.delete(f"/api/users/{uuid.uuid4()}", headers=admin_h)
    assert res.status_code == 404


def test_admin_can_delete_user(client):
    client.post("/api/auth/register", json=_NEW_USER)
    admin_h = _admin_headers(client)
    users = client.get("/api/users", headers=admin_h).json()
    new_id = next(u["id"] for u in users if u["email"] == _NEW_USER["email"])

    res = client.delete(f"/api/users/{new_id}", headers=admin_h)
    assert res.status_code == 204

    remaining = [u["id"] for u in client.get("/api/users", headers=admin_h).json()]
    assert new_id not in remaining
