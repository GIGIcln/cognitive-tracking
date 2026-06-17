"""Integration tests for /api/sessions endpoints."""

import pytest

SESSION_BODY = {
    "session_date": "2025-10-15",
    "session_type": "Allenamento",
    "duration_min": 90,
    "notes": "Test session",
}


def _create_session(c, h, gid):
    res = c.post("/api/sessions", headers=h, json={**SESSION_BODY, "group_id": gid})
    assert res.status_code == 201
    return res.json()["id"]


def test_create_session_returns_201(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    res = c.post("/api/sessions", headers=h, json={**SESSION_BODY, "group_id": gid})
    assert res.status_code == 201
    data = res.json()
    assert data["group_id"] == gid
    assert data["session_type"] == "Allenamento"
    assert "id" in data


def test_create_session_requires_auth(seeded):
    gid = seeded["group_id"]
    res = seeded["client"].post("/api/sessions", json={**SESSION_BODY, "group_id": gid})
    assert res.status_code == 401


def test_create_session_without_season_returns_404(seeded):
    """Season is required; a group without a current season causes 404."""
    import uuid
    c, h = seeded["client"], seeded["headers"]
    res = c.post("/api/sessions", headers=h, json={
        **SESSION_BODY,
        "group_id": str(uuid.uuid4()),  # nonexistent group
    })
    assert res.status_code == 404


def test_list_sessions_returns_all(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    _create_session(c, h, gid)
    _create_session(c, h, gid)
    res = c.get("/api/sessions", headers=h)
    assert res.status_code == 200
    assert len(res.json()["items"]) >= 2


def test_list_sessions_filter_by_group(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    _create_session(c, h, gid)
    res = c.get("/api/sessions", headers=h, params={"group_id": gid})
    assert res.status_code == 200
    assert all(s["group_id"] == gid for s in res.json()["items"])


def test_list_sessions_pagination(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    _create_session(c, h, gid)
    _create_session(c, h, gid)
    res = c.get("/api/sessions", headers=h, params={"limit": 1})
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 1
    assert data["total"] >= 2
    assert data["limit"] == 1


def test_get_session_returns_detail(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    sid = _create_session(c, h, gid)
    res = c.get(f"/api/sessions/{sid}", headers=h)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == sid
    assert data["group_id"] == gid
    assert "measurements" in data
    assert isinstance(data["measurements"], list)


def test_get_nonexistent_session_returns_404(seeded):
    import uuid
    c, h = seeded["client"], seeded["headers"]
    res = c.get(f"/api/sessions/{uuid.uuid4()}", headers=h)
    assert res.status_code == 404


def test_get_session_averages_no_measurements(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    sid = _create_session(c, h, gid)
    res = c.get(f"/api/sessions/{sid}/averages", headers=h)
    assert res.status_code == 200
    data = res.json()
    assert data["player_count"] == 0
    assert data["avg_sr"] is None


def test_get_session_averages_nonexistent_returns_404(seeded):
    import uuid
    c, h = seeded["client"], seeded["headers"]
    res = c.get(f"/api/sessions/{uuid.uuid4()}/averages", headers=h)
    assert res.status_code == 404


def test_get_measurements_empty_list(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    sid = _create_session(c, h, gid)
    res = c.get(f"/api/sessions/{sid}/measurements", headers=h)
    assert res.status_code == 200
    assert res.json() == []


def test_get_measurements_nonexistent_session_returns_404(seeded):
    import uuid
    c, h = seeded["client"], seeded["headers"]
    res = c.get(f"/api/sessions/{uuid.uuid4()}/measurements", headers=h)
    assert res.status_code == 404


def _measurement_payload(player_ids, scores):
    """Costruisce il body per POST /{sid}/measurements."""
    return {
        "measurements": [
            {
                "player_id": pid,
                "scanning_rate": sc,
                "decision_quality": sc,
                "anticipation": sc,
                "transition_reset": sc,
                "verbal_comm": sc,
            }
            for pid, sc in zip(player_ids, scores)
        ]
    }


def test_upsert_measurements_inserts_and_updates(pg_seeded):
    """Prima PUT inserisce; seconda PUT con stessi player_id aggiorna (ON CONFLICT DO UPDATE)."""
    c, h = pg_seeded["client"], pg_seeded["headers"]
    pid1, pid2 = pg_seeded["player_ids"]
    gid = pg_seeded["group_id"]

    sid = _create_session(c, h, gid)

    # ── Primo salvataggio: insert ──────────────────────────────────────────
    res = c.post(f"/api/sessions/{sid}/measurements", headers=h,
                 json=_measurement_payload([pid1, pid2], [7.0, 5.0]))
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    p1 = next(m for m in data if m["player_id"] == pid1)
    assert p1["scanning_rate"] == 7.0

    # ── Secondo salvataggio con valori diversi: upsert deve aggiornare ────
    res2 = c.post(f"/api/sessions/{sid}/measurements", headers=h,
                  json=_measurement_payload([pid1, pid2], [9.0, 8.0]))
    assert res2.status_code == 200
    data2 = res2.json()

    # Deve esserci ancora ESATTAMENTE 1 riga per giocatore — nessun duplicato
    assert len(data2) == 2
    p1_updated = next(m for m in data2 if m["player_id"] == pid1)
    p2_updated = next(m for m in data2 if m["player_id"] == pid2)
    assert p1_updated["scanning_rate"] == 9.0
    assert p1_updated["decision_quality"] == 9.0
    assert p2_updated["scanning_rate"] == 8.0


def test_upsert_measurements_absent_player(pg_seeded):
    """Giocatore assente (is_absent=True, valori nulli) va in upsert senza errori."""
    c, h = pg_seeded["client"], pg_seeded["headers"]
    pid1, pid2 = pg_seeded["player_ids"]
    gid = pg_seeded["group_id"]

    sid = _create_session(c, h, gid)

    # pid1 con punteggi, pid2 assente (nessun punteggio)
    res = c.post(f"/api/sessions/{sid}/measurements", headers=h, json={
        "measurements": [
            {"player_id": pid1, "scanning_rate": 8.0, "decision_quality": 8.0,
             "anticipation": 8.0, "transition_reset": 8.0, "verbal_comm": 8.0},
            {"player_id": pid2, "is_absent": True},
        ]
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    p2 = next(m for m in data if m["player_id"] == pid2)
    assert p2["is_absent"] is True
    assert p2["scanning_rate"] is None

    # pid2 torna presente: upsert deve aggiornare il flag e i punteggi
    res2 = c.post(f"/api/sessions/{sid}/measurements", headers=h, json={
        "measurements": [
            {"player_id": pid2, "is_absent": False, "scanning_rate": 6.0,
             "decision_quality": 6.0, "anticipation": 6.0,
             "transition_reset": 6.0, "verbal_comm": 6.0},
        ]
    })
    assert res2.status_code == 200
    data2 = res2.json()
    # La sessione deve avere ancora 2 misurazioni totali (non 3)
    assert len(data2) == 2
    p2_updated = next(m for m in data2 if m["player_id"] == pid2)
    assert p2_updated["is_absent"] is False
    assert p2_updated["scanning_rate"] == 6.0


def test_upsert_measurements_unknown_player_returns_404(pg_seeded):
    """player_id inesistente causa 404 con messaggio esplicito."""
    import uuid as _uuid
    c, h = pg_seeded["client"], pg_seeded["headers"]
    gid = pg_seeded["group_id"]

    sid = _create_session(c, h, gid)

    res = c.post(f"/api/sessions/{sid}/measurements", headers=h, json={
        "measurements": [{"player_id": str(_uuid.uuid4()), "scanning_rate": 5.0}]
    })
    assert res.status_code == 404
    assert "non trovati" in res.json()["detail"].lower()
