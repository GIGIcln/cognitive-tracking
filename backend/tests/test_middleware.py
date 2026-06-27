"""Tests per il middleware globale (X-Request-ID, error handlers)."""


async def test_request_id_header_present_on_success(client):
    """Ogni risposta deve avere X-Request-ID."""
    res = await client.get("/")
    assert "x-request-id" in res.headers


async def test_request_id_header_echoed_when_provided(client):
    """Se il client manda X-Request-ID, deve essere rimandato identico."""
    custom_id = "test-correlation-123"
    res = await client.get("/", headers={"X-Request-ID": custom_id})
    assert res.headers.get("x-request-id") == custom_id


async def test_request_id_present_on_error_response(client):
    """Anche le risposte 4xx devono riportare X-Request-ID."""
    res = await client.get("/api/auth/me")  # 401 senza token
    assert res.status_code == 401
    assert "x-request-id" in res.headers


async def test_validation_error_returns_422_with_detail(client):
    """RequestValidationError deve restituire 422 con il campo detail."""
    res = await client.post("/api/auth/login", json={"email": "not-an-email", "password": "x"})
    assert res.status_code == 422
    data = res.json()
    assert "detail" in data
    assert "x-request-id" in res.headers


async def test_unknown_route_returns_404_with_request_id(client):
    """Una rotta inesistente deve dare 404 con X-Request-ID."""
    res = await client.get("/api/questa-rotta-non-esiste")
    assert res.status_code == 404
    assert "x-request-id" in res.headers


async def test_health_returns_ok(client):
    """/api/health deve rispondere 200 con {"status": "ok"} senza esporre dettagli DB."""
    res = await client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data == {"status": "ok"}
    assert "database" not in data
