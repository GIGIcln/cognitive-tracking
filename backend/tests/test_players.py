"""Integration tests for /api/players endpoints."""


def test_list_players_empty(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = c.get("/api/players", headers=h)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data and "total" in data
    assert any(p["last_name"] == "Rossi" for p in data["items"])


def test_list_players_requires_auth(seeded):
    res = seeded["anon_client"].get("/api/players")
    assert res.status_code == 401


def test_create_player_returns_201(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = c.post("/api/players", headers=h, json={
        "first_name": "Luca",
        "last_name": "Bianchi",
        "birth_year": 2009,
    })
    assert res.status_code == 201
    data = res.json()
    assert data["first_name"] == "Luca"
    assert data["last_name"] == "Bianchi"
    assert data["is_active"] is True


def test_create_player_with_group_assigns_group(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    res = c.post("/api/players", headers=h, json={
        "first_name": "Carlo",
        "last_name": "Verdi",
        "birth_year": 2010,
        "group_id": gid,
    })
    assert res.status_code == 201
    # Should appear in group player list
    players = c.get("/api/players", headers=h, params={"group_id": gid}).json()["items"]
    assert any(p["last_name"] == "Verdi" for p in players)


def test_update_player(seeded):
    c, h, pid = seeded["client"], seeded["headers"], seeded["player_id"]
    res = c.put(f"/api/players/{pid}", headers=h, json={"first_name": "Giuseppe"})
    assert res.status_code == 200
    assert res.json()["first_name"] == "Giuseppe"


def test_update_nonexistent_player_returns_404(seeded):
    import uuid
    c, h = seeded["client"], seeded["headers"]
    res = c.put(f"/api/players/{uuid.uuid4()}", headers=h, json={"first_name": "X"})
    assert res.status_code == 404


def test_delete_player_soft_deletes(seeded):
    c, h = seeded["client"], seeded["headers"]
    # Create then delete
    pid = c.post("/api/players", headers=h, json={
        "first_name": "Da", "last_name": "Cancellare", "birth_year": 2008,
    }).json()["id"]
    res = c.delete(f"/api/players/{pid}", headers=h)
    assert res.status_code == 200
    # Player no longer appears in active list
    active = c.get("/api/players", headers=h).json()["items"]
    assert not any(p["id"] == pid for p in active)


def test_delete_nonexistent_player_returns_404(seeded):
    import uuid
    res = seeded["client"].delete(f"/api/players/{uuid.uuid4()}", headers=seeded["headers"])
    assert res.status_code == 404


def test_assign_player_to_group(seeded):
    c, h = seeded["client"], seeded["headers"]
    pid, gid = seeded["player_id"], seeded["group_id"]
    res = c.post(f"/api/players/{pid}/assign", headers=h, json={"group_id": gid})
    assert res.status_code == 200
    assert res.json()["group_id"] == gid


def test_assign_nonexistent_player_returns_404(seeded):
    import uuid
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    res = c.post(f"/api/players/{uuid.uuid4()}/assign", headers=h, json={"group_id": gid})
    assert res.status_code == 404


def test_get_player_history_returns_list(seeded):
    c, h, pid = seeded["client"], seeded["headers"], seeded["player_id"]
    res = c.get(f"/api/players/{pid}/history", headers=h)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_list_players_filter_by_group(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    # Assign seeded player to group
    c.post(f"/api/players/{seeded['player_id']}/assign", headers=h, json={"group_id": gid})
    res = c.get("/api/players", headers=h, params={"group_id": gid})
    assert res.status_code == 200
    assert all(p["current_group_name"] is not None for p in res.json()["items"])


def test_list_players_pagination(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = c.get("/api/players", headers=h, params={"skip": 0, "limit": 1})
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) <= 1
    assert data["total"] >= 0
    assert data["limit"] == 1


# ── At-risk ───────────────────────────────────────────────────────────────────

def test_get_at_risk_requires_auth(seeded):
    res = seeded["anon_client"].get("/api/players/at-risk")
    assert res.status_code == 401


def test_get_at_risk_returns_empty_without_targets(seeded):
    """Gruppi senza target configurati non producono allerte."""
    c, h = seeded["client"], seeded["headers"]
    res = c.get("/api/players/at-risk", headers=h)
    assert res.status_code == 200
    assert res.json() == []


def test_get_at_risk_detects_player_below_threshold(pg_seeded):
    """Giocatore con 3 sessioni consecutive sotto soglia appare nella lista."""
    c, h = pg_seeded["client"], pg_seeded["headers"]
    pid = pg_seeded["player_ids"][0]
    gid = pg_seeded["group_id"]

    # 1. Imposta soglia insufficiente = 6.0 su tutti i parametri
    c.put(f"/api/groups/{gid}/targets", headers=h, json=[
        {"parameter": p, "insufficient_max": 6.0, "ottimo_min": 8.0}
        for p in ("scanning_rate", "decision_quality", "anticipation",
                  "transition_reset", "verbal_comm")
    ])

    # 2. Assegna il giocatore al gruppo
    c.post(f"/api/players/{pid}/assign", headers=h, json={"group_id": gid})

    # 3. Crea 3 sessioni con punteggio 4.0 (sotto soglia)
    for day in ("2025-10-01", "2025-10-08", "2025-10-15"):
        sid = c.post("/api/sessions", headers=h, json={
            "group_id": gid,
            "session_date": day,
            "session_type": "Allenamento",
            "duration_min": 90,
        }).json()["id"]
        c.post(f"/api/sessions/{sid}/measurements", headers=h, json={
            "measurements": [{
                "player_id": pid,
                "scanning_rate": 4.0,
                "decision_quality": 4.0,
                "anticipation": 4.0,
                "transition_reset": 4.0,
                "verbal_comm": 4.0,
            }]
        })

    res = c.get("/api/players/at-risk", headers=h)
    assert res.status_code == 200
    at_risk = res.json()
    match = next((p for p in at_risk if p["player_id"] == pid), None)
    assert match is not None, "Il giocatore sotto soglia non appare nella lista at-risk"
    assert match["avg_score_last_session"] < match["threshold"]
    assert match["consecutive_low_sessions"] == 3
