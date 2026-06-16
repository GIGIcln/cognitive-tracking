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
    assert len(res.json()) >= 2


def test_list_sessions_filter_by_group(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    _create_session(c, h, gid)
    res = c.get("/api/sessions", headers=h, params={"group_id": gid})
    assert res.status_code == 200
    assert all(s["group_id"] == gid for s in res.json())


def test_list_sessions_pagination(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    _create_session(c, h, gid)
    _create_session(c, h, gid)
    res = c.get("/api/sessions", headers=h, params={"limit": 1})
    assert res.status_code == 200
    assert len(res.json()) == 1


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


@pytest.mark.skip(reason="upsert_measurements usa dialetto PostgreSQL, non compatibile con SQLite")
def test_upsert_measurements():
    pass
