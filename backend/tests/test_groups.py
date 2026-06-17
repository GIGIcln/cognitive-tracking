"""Integration tests for /api/groups endpoints."""


def test_list_groups_returns_current_season_groups(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = c.get("/api/groups", headers=h)
    assert res.status_code == 200
    groups = res.json()
    assert len(groups) >= 1
    assert any(g["name"] == "Under 15" for g in groups)


def test_list_groups_requires_auth(seeded):
    res = seeded["anon_client"].get("/api/groups")
    assert res.status_code == 401


def test_get_group_returns_detail_with_players_and_targets(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    res = c.get(f"/api/groups/{gid}", headers=h)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == gid
    assert data["name"] == "Under 15"
    assert "players" in data
    assert "targets" in data
    assert isinstance(data["players"], list)
    assert isinstance(data["targets"], list)


def test_get_group_players_after_assignment(seeded):
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]
    c.post(f"/api/players/{pid}/assign", headers=h, json={"group_id": gid})
    res = c.get(f"/api/groups/{gid}", headers=h)
    players = res.json()["players"]
    assert any(p["id"] == pid for p in players)


def test_get_nonexistent_group_returns_404(seeded):
    import uuid
    c, h = seeded["client"], seeded["headers"]
    res = c.get(f"/api/groups/{uuid.uuid4()}", headers=h)
    assert res.status_code == 404


def test_get_group_targets_empty_by_default(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    res = c.get(f"/api/groups/{gid}/targets", headers=h)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_update_targets_creates_new(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    payload = [
        {"parameter": "scanning_rate", "insufficient_max": 4.0, "ottimo_min": 7.0},
        {"parameter": "anticipation", "insufficient_max": 3.5, "ottimo_min": 6.5},
    ]
    res = c.put(f"/api/groups/{gid}/targets", headers=h, json=payload)
    assert res.status_code == 200
    targets = res.json()
    params = {t["parameter"] for t in targets}
    assert "scanning_rate" in params
    assert "anticipation" in params


def test_update_targets_overwrites_existing(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    c.put(f"/api/groups/{gid}/targets", headers=h, json=[
        {"parameter": "scanning_rate", "insufficient_max": 4.0, "ottimo_min": 7.0},
    ])
    res = c.put(f"/api/groups/{gid}/targets", headers=h, json=[
        {"parameter": "scanning_rate", "insufficient_max": 5.0, "ottimo_min": 8.0},
    ])
    assert res.status_code == 200
    target = next(t for t in res.json() if t["parameter"] == "scanning_rate")
    assert float(target["insufficient_max"]) == 5.0
    assert float(target["ottimo_min"]) == 8.0


def test_get_group_history_returns_list(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    res = c.get(f"/api/groups/{gid}/history", headers=h)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_group_history_contains_session_after_creation(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    c.post("/api/sessions", headers=h, json={
        "group_id": gid,
        "session_date": "2025-10-01",
        "session_type": "Allenamento",
        "duration_min": 90,
    })
    res = c.get(f"/api/groups/{gid}/history", headers=h)
    assert res.status_code == 200
    assert len(res.json()) >= 1
