"""Integration tests for /api/players endpoints."""


def test_list_players_empty(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = c.get("/api/players", headers=h)
    assert res.status_code == 200
    # Seeded player exists
    assert any(p["last_name"] == "Rossi" for p in res.json())


def test_list_players_requires_auth(seeded):
    res = seeded["client"].get("/api/players")
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
    players = c.get("/api/players", headers=h, params={"group_id": gid}).json()
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
    active = c.get("/api/players", headers=h).json()
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
    assert all(p["current_group_name"] is not None for p in res.json())


def test_list_players_pagination(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = c.get("/api/players", headers=h, params={"skip": 0, "limit": 1})
    assert res.status_code == 200
    assert len(res.json()) <= 1
