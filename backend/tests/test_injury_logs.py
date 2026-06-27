"""
Test per /api/injury-logs (GS-07).

Nota: il player nel fixture `seeded` non ha un PlayerGroupAssignment.
- Test admin: usano direttamente seeded["player_id"] (admin bypassa controllo gruppo).
- Test coach: creano un player assegnato via /api/players con group_id.
- Test player list: assegnano il player al gruppo prima del controllo.
"""
import uuid
from datetime import date, timedelta

_ADMIN_LOGIN = {"email": "admin@test.com", "password": "Admin123"}
_COACH_LOGIN = {"email": "coach@test.com", "password": "Admin123"}

_TODAY = date.today().isoformat()


async def _headers(client, credentials) -> dict:
    token = (await client.post("/api/auth/login", json=credentials)).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_assigned_player(client, headers, group_id) -> str:
    """Crea un giocatore già assegnato al gruppo, restituisce il player_id."""
    res = await client.post("/api/players", headers=headers, json={
        "first_name": "Test", "last_name": "Infortuni",
        "birth_year": 2010, "group_id": group_id,
    })
    assert res.status_code == 201
    return res.json()["id"]


# ── CREATE ────────────────────────────────────────────────────────────────────

async def test_admin_can_create_injury(seeded):
    c, h, pid = seeded["client"], seeded["headers"], seeded["player_id"]
    res = await c.post(f"/api/injury-logs/player/{pid}", headers=h, json={
        "injury_type": "Distorsione caviglia",
        "start_date": _TODAY,
        "severity": "moderato",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["injury_type"] == "Distorsione caviglia"
    assert data["player_id"] == pid
    assert data["actual_return"] is None
    assert data["severity"] == "moderato"


async def test_create_injury_unknown_player_returns_404(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = await c.post(f"/api/injury-logs/player/{uuid.uuid4()}", headers=h, json={
        "injury_type": "Lesione",
        "start_date": _TODAY,
        "severity": "grave",
    })
    assert res.status_code == 404


async def test_coach_can_create_injury_for_own_player(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    pid = await _create_assigned_player(c, h, gid)
    coach_h = await _headers(c, _COACH_LOGIN)
    res = await c.post(f"/api/injury-logs/player/{pid}", headers=coach_h, json={
        "injury_type": "Contusione",
        "start_date": _TODAY,
        "severity": "lieve",
    })
    assert res.status_code == 201


async def test_coach_cannot_create_injury_for_player_without_group(seeded):
    """Coach ottiene 403 per player senza assignment (impossibile verificare il gruppo)."""
    c, pid = seeded["client"], seeded["player_id"]
    coach_h = await _headers(c, _COACH_LOGIN)
    res = await c.post(f"/api/injury-logs/player/{pid}", headers=coach_h, json={
        "injury_type": "Lesione", "start_date": _TODAY, "severity": "moderato",
    })
    assert res.status_code == 403


# ── LIST ──────────────────────────────────────────────────────────────────────

async def test_list_injuries_for_player(seeded):
    c, h, pid = seeded["client"], seeded["headers"], seeded["player_id"]
    await c.post(f"/api/injury-logs/player/{pid}", headers=h, json={
        "injury_type": "Stiramento", "start_date": _TODAY, "severity": "moderato",
    })
    res = await c.get(f"/api/injury-logs/player/{pid}", headers=h)
    assert res.status_code == 200
    assert len(res.json()) >= 1
    assert res.json()[0]["injury_type"] == "Stiramento"


async def test_list_injuries_empty_for_player_without_injuries(seeded):
    c, h, pid = seeded["client"], seeded["headers"], seeded["player_id"]
    res = await c.get(f"/api/injury-logs/player/{pid}", headers=h)
    assert res.status_code == 200
    assert res.json() == []


# ── UPDATE ────────────────────────────────────────────────────────────────────

async def test_update_injury_adds_actual_return(seeded):
    c, h, pid = seeded["client"], seeded["headers"], seeded["player_id"]
    inj_id = (await c.post(f"/api/injury-logs/player/{pid}", headers=h, json={
        "injury_type": "Lesione muscolare", "start_date": _TODAY, "severity": "grave",
    })).json()["id"]

    res = await c.patch(f"/api/injury-logs/{inj_id}", headers=h, json={"actual_return": _TODAY})
    assert res.status_code == 200
    assert res.json()["actual_return"] == _TODAY


async def test_update_nonexistent_injury_returns_404(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = await c.patch(f"/api/injury-logs/{uuid.uuid4()}", headers=h, json={"severity": "lieve"})
    assert res.status_code == 404


# ── DELETE ────────────────────────────────────────────────────────────────────

async def test_admin_can_delete_injury(seeded):
    c, h, pid = seeded["client"], seeded["headers"], seeded["player_id"]
    inj_id = (await c.post(f"/api/injury-logs/player/{pid}", headers=h, json={
        "injury_type": "Frattura", "start_date": _TODAY, "severity": "grave",
    })).json()["id"]

    res = await c.delete(f"/api/injury-logs/{inj_id}", headers=h)
    assert res.status_code == 204

    remaining = (await c.get(f"/api/injury-logs/player/{pid}", headers=h)).json()
    assert all(r["id"] != inj_id for r in remaining)


async def test_delete_nonexistent_injury_returns_404(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = await c.delete(f"/api/injury-logs/{uuid.uuid4()}", headers=h)
    assert res.status_code == 404


# ── AVAILABILITY ──────────────────────────────────────────────────────────────

async def test_player_availability_is_infortunato_after_grave_injury(seeded):
    c, h, pid = seeded["client"], seeded["headers"], seeded["player_id"]
    await c.post(f"/api/injury-logs/player/{pid}", headers=h, json={
        "injury_type": "Lesione legamento", "start_date": _TODAY, "severity": "grave",
    })
    player = (await c.get(f"/api/players/{pid}", headers=h)).json()
    assert player["availability"] == "infortunato"


async def test_player_availability_is_limitato_after_lieve_injury(seeded):
    c, h, pid = seeded["client"], seeded["headers"], seeded["player_id"]
    await c.post(f"/api/injury-logs/player/{pid}", headers=h, json={
        "injury_type": "Contusione lieve", "start_date": _TODAY, "severity": "lieve",
    })
    player = (await c.get(f"/api/players/{pid}", headers=h)).json()
    assert player["availability"] == "limitato"


async def test_player_availability_returns_to_disponibile_after_actual_return(seeded):
    c, h, pid = seeded["client"], seeded["headers"], seeded["player_id"]
    inj_id = (await c.post(f"/api/injury-logs/player/{pid}", headers=h, json={
        "injury_type": "Stiramento", "start_date": _TODAY, "severity": "moderato",
    })).json()["id"]

    await c.patch(f"/api/injury-logs/{inj_id}", headers=h, json={"actual_return": _TODAY})

    player = (await c.get(f"/api/players/{pid}", headers=h)).json()
    assert player["availability"] == "disponibile"


async def test_player_list_includes_availability(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    pid = await _create_assigned_player(c, h, gid)
    await c.post(f"/api/injury-logs/player/{pid}", headers=h, json={
        "injury_type": "Lesione", "start_date": _TODAY, "severity": "grave",
    })
    players = (await c.get(f"/api/players?group_id={gid}", headers=h)).json()["items"]
    target = next(p for p in players if p["id"] == pid)
    assert target["availability"] == "infortunato"
