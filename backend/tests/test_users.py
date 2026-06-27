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


async def _admin_headers(client) -> dict:
    token = (await client.post("/api/auth/login", json=_ADMIN_LOGIN)).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _coach_headers(client) -> dict:
    token = (await client.post("/api/auth/login", json=_COACH_LOGIN)).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── /auth/register ────────────────────────────────────────────────────────────

async def test_register_creates_pending_allenatore(client):
    res = await client.post("/api/auth/register", json=_NEW_USER)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == _NEW_USER["email"]
    assert data["status"] == "pending"
    assert data["roles"] == ["allenatore"]
    assert data["is_active"] is False


async def test_register_duplicate_email_returns_409(client):
    await client.post("/api/auth/register", json=_NEW_USER)
    res = await client.post("/api/auth/register", json=_NEW_USER)
    assert res.status_code == 409


async def test_pending_user_cannot_login(client):
    await client.post("/api/auth/register", json=_NEW_USER)
    res = await client.post("/api/auth/login", json={
        "email": _NEW_USER["email"],
        "password": _NEW_USER["password"],
    })
    assert res.status_code == 401


# ── GET /api/users ────────────────────────────────────────────────────────────

async def test_admin_can_list_users(client):
    res = await client.get("/api/users", headers=await _admin_headers(client))
    assert res.status_code == 200
    emails = [u["email"] for u in res.json()]
    assert "admin@test.com" in emails


async def test_coach_cannot_list_users(client):
    res = await client.get("/api/users", headers=await _coach_headers(client))
    assert res.status_code == 403


async def test_unauthenticated_cannot_list_users(client):
    assert (await client.get("/api/users")).status_code == 401


# ── PATCH /api/users/{id} ─────────────────────────────────────────────────────

async def _get_coach_id(client, admin_h) -> str:
    users = (await client.get("/api/users", headers=admin_h)).json()
    return next(u["id"] for u in users if u["email"] == "coach@test.com")


async def test_admin_can_activate_pending_user(client):
    await client.post("/api/auth/register", json=_NEW_USER)
    admin_h = await _admin_headers(client)
    users = (await client.get("/api/users", headers=admin_h)).json()
    new_id = next(u["id"] for u in users if u["email"] == _NEW_USER["email"])

    res = await client.patch(f"/api/users/{new_id}", headers=admin_h, json={"status": "active"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "active"
    assert data["is_active"] is True


async def test_admin_can_change_roles(client):
    admin_h = await _admin_headers(client)
    coach_id = await _get_coach_id(client, admin_h)

    res = await client.patch(f"/api/users/{coach_id}", headers=admin_h,
                             json={"roles": ["allenatore", "responsabile_tecnico"]})
    assert res.status_code == 200
    assert set(res.json()["roles"]) == {"allenatore", "responsabile_tecnico"}


async def test_coach_cannot_patch_user(client):
    admin_h = await _admin_headers(client)
    coach_id = await _get_coach_id(client, admin_h)
    res = await client.patch(f"/api/users/{coach_id}", headers=await _coach_headers(client),
                             json={"status": "suspended"})
    assert res.status_code == 403


# ── DELETE /api/users/{id} ────────────────────────────────────────────────────

async def test_admin_cannot_delete_self(client):
    admin_h = await _admin_headers(client)
    admin_id = next(
        u["id"] for u in (await client.get("/api/users", headers=admin_h)).json()
        if u["email"] == "admin@test.com"
    )
    res = await client.delete(f"/api/users/{admin_id}", headers=admin_h)
    assert res.status_code == 400


async def test_delete_nonexistent_user_returns_404(client):
    admin_h = await _admin_headers(client)
    res = await client.delete(f"/api/users/{uuid.uuid4()}", headers=admin_h)
    assert res.status_code == 404


async def test_admin_can_delete_user(client):
    await client.post("/api/auth/register", json=_NEW_USER)
    admin_h = await _admin_headers(client)
    users = (await client.get("/api/users", headers=admin_h)).json()
    new_id = next(u["id"] for u in users if u["email"] == _NEW_USER["email"])

    res = await client.delete(f"/api/users/{new_id}", headers=admin_h)
    assert res.status_code == 204

    remaining = [u["id"] for u in (await client.get("/api/users", headers=admin_h)).json()]
    assert new_id not in remaining
