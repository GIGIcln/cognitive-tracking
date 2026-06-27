"""Integration tests for /api/seasons endpoints."""


# ── GET /seasons/current ──────────────────────────────────────────────────────

async def test_get_current_season_returns_200(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = await c.get("/api/seasons/current", headers=h)
    assert res.status_code == 200
    data = res.json()
    assert data["is_current"] is True
    assert "name" in data
    assert "id" in data


async def test_get_current_season_requires_auth(seeded):
    res = await seeded["anon_client"].get("/api/seasons/current")
    assert res.status_code == 401


# ── GET /seasons (admin only) ─────────────────────────────────────────────────

async def test_list_seasons_returns_all(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = await c.get("/api/seasons", headers=h)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert len(res.json()) >= 1


async def test_list_seasons_accessible_to_coach(seeded):
    c = seeded["client"]
    from tests.conftest import _TEST_PASSWORD
    login = await c.post("/api/auth/login", json={"email": "coach@test.com", "password": _TEST_PASSWORD})
    coach_token = login.json()["access_token"]
    res = await c.get("/api/seasons", headers={"Authorization": f"Bearer {coach_token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)


# ── POST /seasons ─────────────────────────────────────────────────────────────

async def test_create_season_archives_current_and_creates_new(seeded):
    c, h = seeded["client"], seeded["headers"]

    old = (await c.get("/api/seasons/current", headers=h)).json()
    assert old["is_current"] is True

    res = await c.post("/api/seasons", headers=h, json={
        "name": "2027-2028",
        "start_date": "2027-09-01",
        "end_date": "2028-06-30",
    })
    assert res.status_code == 201
    new = res.json()
    assert new["name"] == "2027-2028"
    assert new["is_current"] is True

    current = (await c.get("/api/seasons/current", headers=h)).json()
    assert current["id"] == new["id"]
    assert current["name"] == "2027-2028"

    all_seasons = (await c.get("/api/seasons", headers=h)).json()
    assert len(all_seasons) == 2
    assert sum(1 for s in all_seasons if s["is_current"]) == 1


async def test_create_season_without_dates_is_valid(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = await c.post("/api/seasons", headers=h, json={"name": "2027-2028"})
    assert res.status_code == 201
    data = res.json()
    assert data["start_date"] is None
    assert data["end_date"] is None


async def test_create_season_requires_admin(seeded):
    c = seeded["client"]
    from tests.conftest import _TEST_PASSWORD
    login = await c.post("/api/auth/login", json={"email": "coach@test.com", "password": _TEST_PASSWORD})
    coach_token = login.json()["access_token"]
    res = await c.post("/api/seasons", headers={"Authorization": f"Bearer {coach_token}"},
                       json={"name": "2027-2028"})
    assert res.status_code == 403


# ── PUT /seasons/{id}/archive ─────────────────────────────────────────────────

async def test_archive_season_sets_is_current_false(seeded):
    c, h = seeded["client"], seeded["headers"]
    season_id = seeded["season_id"]

    res = await c.put(f"/api/seasons/{season_id}/archive", headers=h)
    assert res.status_code == 200
    data = res.json()
    assert data["is_current"] is False
    assert data["id"] == season_id


async def test_archive_nonexistent_season_returns_404(seeded):
    import uuid
    c, h = seeded["client"], seeded["headers"]
    res = await c.put(f"/api/seasons/{uuid.uuid4()}/archive", headers=h)
    assert res.status_code == 404


async def test_archive_season_requires_admin(seeded):
    c = seeded["client"]
    from tests.conftest import _TEST_PASSWORD
    season_id = seeded["season_id"]
    login = await c.post("/api/auth/login", json={"email": "coach@test.com", "password": _TEST_PASSWORD})
    coach_token = login.json()["access_token"]
    res = await c.put(f"/api/seasons/{season_id}/archive",
                      headers={"Authorization": f"Bearer {coach_token}"})
    assert res.status_code == 403
