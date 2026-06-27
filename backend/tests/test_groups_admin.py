"""Integration tests for admin-only group operations (create, delete)."""

import uuid


async def test_create_group_admin_returns_201(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = await c.post("/api/groups", headers=h, json={
        "name": "Under 17",
        "category": "Agonistica",
        "birth_year": 2008,
        "level": "A",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Under 17"
    assert data["birth_year"] == 2008
    assert "id" in data


async def test_create_group_appears_in_list(seeded):
    c, h = seeded["client"], seeded["headers"]
    await c.post("/api/groups", headers=h, json={
        "name": "Under 13",
        "category": "Promozionale",
        "birth_year": 2012,
        "level": "B",
    })
    groups = (await c.get("/api/groups", headers=h)).json()
    assert any(g["name"] == "Under 13" for g in groups)


async def test_delete_group_admin_returns_204(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    res = await c.delete(f"/api/groups/{gid}", headers=h)
    assert res.status_code == 204


async def test_delete_group_removes_it_from_list(seeded):
    c, h, gid = seeded["client"], seeded["headers"], seeded["group_id"]
    before = (await c.get("/api/groups", headers=h)).json()
    assert any(g["id"] == gid for g in before)

    await c.delete(f"/api/groups/{gid}", headers=h)

    after = (await c.get("/api/groups", headers=h)).json()
    assert not any(g["id"] == gid for g in after)


async def test_delete_nonexistent_group_returns_404(seeded):
    c, h = seeded["client"], seeded["headers"]
    res = await c.delete(f"/api/groups/{uuid.uuid4()}", headers=h)
    assert res.status_code == 404
