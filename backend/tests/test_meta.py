"""Tests per GET /api/meta/metrics."""

from app.codebook import METRIC_DEFINITIONS, METRIC_MIN_N, METRIC_TO_FIELD


async def test_get_metrics_returns_all_definitions(client):
    res = await client.get("/api/meta/metrics")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == len(METRIC_DEFINITIONS)


async def test_get_metrics_no_auth_required(client):
    """L'endpoint è pubblico — nessun token necessario."""
    res = await client.get("/api/meta/metrics")
    assert res.status_code == 200


async def test_get_metrics_fields_present(client):
    res = await client.get("/api/meta/metrics")
    for m in res.json():
        assert "field" in m
        assert "label" in m
        assert "metric_type" in m
        assert "min_n" in m
        assert "reliability_n_basis" in m


def test_metric_min_n_derived_from_definitions():
    """METRIC_MIN_N deve essere coerente con METRIC_DEFINITIONS."""
    for m in METRIC_DEFINITIONS:
        mt = m["metric_type"]
        if m["min_n"] is not None:
            assert METRIC_MIN_N[mt] == m["min_n"]
        else:
            assert mt not in METRIC_MIN_N


def test_metric_to_field_derived_from_definitions():
    """METRIC_TO_FIELD deve mappare ogni metric_type al campo Measurement."""
    for m in METRIC_DEFINITIONS:
        assert METRIC_TO_FIELD[m["metric_type"]] == m["field"]


async def test_get_metrics_sr_reliability_n_basis(client):
    """SR deve usare count_rows come base per la reliability (non denominator)."""
    res = await client.get("/api/meta/metrics")
    sr = next(m for m in res.json() if m["metric_type"] == "SR")
    assert sr["reliability_n_basis"] == "count_rows"
    assert sr["min_n"] == 6
