"""
Test del sistema RBAC: guards, permessi e data scoping.
Questo file ha sostituito i vecchi test del rimosso endpoint /auth/setup.
"""

_ADMIN_LOGIN = {"email": "admin@test.com", "password": "Admin123"}
_COACH_LOGIN = {"email": "coach@test.com", "password": "Admin123"}
_RESP_LOGIN  = {"email": "responsabile@test.com", "password": "Admin123"}


async def _token(client, credentials) -> dict:
    token = (await client.post("/api/auth/login", json=credentials)).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── Autenticazione base ───────────────────────────────────────────────────────

async def test_setup_endpoint_removed(client):
    """L'endpoint /auth/setup non esiste più — gli utenti si gestiscono via DB (/api/users)."""
    res = await client.post("/api/auth/setup", json={
        "email": "x@x.com", "password": "Pass123!", "full_name": "X"
    })
    assert res.status_code in (404, 405)


# ── require_admin: solo admin può scrivere su gruppi/giocatori ────────────────

async def test_coach_cannot_create_group_returns_403(client):
    h = await _token(client, _COACH_LOGIN)
    res = await client.post("/api/groups", headers=h, json={
        "name": "Test", "category": "Agonistica", "birth_year": 2010, "level": "A"
    })
    assert res.status_code == 403


async def test_responsabile_cannot_create_group_returns_403(client):
    h = await _token(client, _RESP_LOGIN)
    res = await client.post("/api/groups", headers=h, json={
        "name": "Test", "category": "Agonistica", "birth_year": 2010, "level": "A"
    })
    assert res.status_code == 403


async def test_coach_cannot_create_player_returns_403(client):
    h = await _token(client, _COACH_LOGIN)
    res = await client.post("/api/players", headers=h, json={
        "first_name": "X", "last_name": "Y", "birth_year": 2010
    })
    assert res.status_code == 403


async def test_coach_cannot_assign_player_returns_403(client):
    import uuid
    h = await _token(client, _COACH_LOGIN)
    res = await client.post(f"/api/players/{uuid.uuid4()}/assign", headers=h,
                            json={"group_id": str(uuid.uuid4())})
    assert res.status_code == 403


async def test_coach_cannot_delete_session_returns_403(seeded):
    """Allenatore non può eliminare sessioni (solo admin)."""
    c, admin_h = seeded["client"], seeded["headers"]
    gid = seeded["group_id"]

    sess = await c.post("/api/sessions", headers=admin_h, json={
        "group_id": gid,
        "session_date": "2025-11-01",
        "session_type": "Allenamento",
        "duration_min": 60,
    })
    assert sess.status_code == 201
    session_id = sess.json()["id"]

    login_resp = await c.post("/api/auth/login", json=_COACH_LOGIN)
    coach_h = {"Authorization": "Bearer " + login_resp.json()["access_token"]}
    res = await c.delete(f"/api/sessions/{session_id}", headers=coach_h)
    assert res.status_code == 403


# ── Data scoping: allenatore vede solo i propri gruppi ───────────────────────

async def test_coach_sees_only_own_group(seeded):
    """L'allenatore (coach) ha il gruppo seeded assegnato → lo vede nella lista."""
    c = seeded["client"]
    login_resp = await c.post("/api/auth/login", json=_COACH_LOGIN)
    coach_h = {"Authorization": "Bearer " + login_resp.json()["access_token"]}
    res = await c.get("/api/groups", headers=coach_h)
    assert res.status_code == 200
    groups = res.json()
    assert len(groups) == 1
    assert groups[0]["id"] == seeded["group_id"]


async def test_responsabile_sees_all_groups(seeded):
    """Il responsabile tecnico vede tutti i gruppi senza restrizioni."""
    c = seeded["client"]
    login_resp = await c.post("/api/auth/login", json=_RESP_LOGIN)
    resp_h = {"Authorization": "Bearer " + login_resp.json()["access_token"]}
    res = await c.get("/api/groups", headers=resp_h)
    assert res.status_code == 200
    assert len(res.json()) >= 1


async def test_coach_cannot_access_other_group_returns_403(seeded):
    """L'allenatore non può accedere a un gruppo non assegnato."""
    import uuid
    c = seeded["client"]
    login_resp = await c.post("/api/auth/login", json=_COACH_LOGIN)
    coach_h = {"Authorization": "Bearer " + login_resp.json()["access_token"]}
    res = await c.get(f"/api/groups/{uuid.uuid4()}", headers=coach_h)
    assert res.status_code == 403


async def test_coach_can_create_session_for_own_group(seeded):
    """L'allenatore può creare sessioni per il proprio gruppo."""
    c = seeded["client"]
    login_resp = await c.post("/api/auth/login", json=_COACH_LOGIN)
    coach_h = {"Authorization": "Bearer " + login_resp.json()["access_token"]}
    res = await c.post("/api/sessions", headers=coach_h, json={
        "group_id": seeded["group_id"],
        "session_date": "2025-12-01",
        "session_type": "Allenamento",
        "duration_min": 75,
    })
    assert res.status_code == 201


async def test_responsabile_cannot_create_session_returns_403(seeded):
    """Il responsabile tecnico non può scrivere sessioni."""
    c = seeded["client"]
    login_resp = await c.post("/api/auth/login", json=_RESP_LOGIN)
    resp_h = {"Authorization": "Bearer " + login_resp.json()["access_token"]}
    res = await c.post("/api/sessions", headers=resp_h, json={
        "group_id": seeded["group_id"],
        "session_date": "2025-12-01",
        "session_type": "Allenamento",
        "duration_min": 75,
    })
    assert res.status_code == 403


# ── Admin: accesso completo ───────────────────────────────────────────────────

async def test_unauthenticated_request_returns_401(client):
    assert (await client.get("/api/groups")).status_code == 401
    assert (await client.get("/api/players")).status_code == 401
    assert (await client.get("/api/sessions")).status_code == 401
