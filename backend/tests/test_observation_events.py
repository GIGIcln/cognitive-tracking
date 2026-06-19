"""Integration tests for POST/GET /api/sessions/{sid}/events.

All tests use the `seeded` fixture (SQLite, one player, admin auth) because
the new delete-then-insert strategy is standard SQL — no PostgreSQL-specific
features required.
"""

import pytest

_SESSION_BODY = {
    "session_date": "2025-10-15",
    "session_type": "Allenamento",
    "duration_min": 90,
    "notes": "Test events",
}


def _create_session(c, h, gid):
    res = c.post("/api/sessions", headers=h, json={**_SESSION_BODY, "group_id": gid})
    assert res.status_code == 201, res.json()
    return res.json()["id"]


def _post_events(c, h, sid, events):
    return c.post(f"/api/sessions/{sid}/events", headers=h, json={"events": events})


def _get_events(c, h, sid):
    return c.get(f"/api/sessions/{sid}/events", headers=h)


def _get_measurements(c, h, sid):
    return c.get(f"/api/sessions/{sid}/measurements", headers=h)


# ── Test 1: GET-OR-CREATE ─────────────────────────────────────────────────────

def test_events_creates_measurement_row_when_none_exists(seeded):
    """Caso senza measurements preesistente: il write-back deve creare la riga
    con il campo corretto e lasciare NULL le metriche non inviate."""
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]

    sid = _create_session(c, h, gid)

    # Invia solo SR: numerator=8, denominator=12  → score = 1 + (8/12)*9 ≈ 7.0
    res = _post_events(c, h, sid, [
        {"player_id": pid, "metric_type": "SR", "numerator": 8, "denominator": 12},
    ])
    assert res.status_code == 200, res.json()

    measurements = _get_measurements(c, h, sid).json()
    assert len(measurements) == 1, "deve esserci esattamente una riga measurements"
    m = measurements[0]
    assert m["player_id"] == pid

    expected_sr = round(min(10.0, max(1.0, 1.0 + (8 / 12) * 9.0)), 1)  # 7.0
    assert m["scanning_rate"] == pytest.approx(expected_sr, abs=0.05)

    # Le metriche non inviate devono restare NULL
    assert m["decision_quality"] is None
    assert m["anticipation"] is None
    assert m["transition_reset"] is None
    assert m["verbal_comm"] is None


# ── Test 2: IDEMPOTENZA ───────────────────────────────────────────────────────

def test_events_idempotency_no_duplicate_rows(seeded):
    """Il secondo invio dello stesso batch non deve produrre righe duplicate né
    raddoppiare lo score in measurements."""
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]

    sid = _create_session(c, h, gid)
    events = [{"player_id": pid, "metric_type": "SR", "numerator": 5, "denominator": 10}]

    # Primo invio
    r1 = _post_events(c, h, sid, events)
    assert r1.status_code == 200, r1.json()
    rows_after_first = len(_get_events(c, h, sid).json())

    # Secondo invio — stesso batch identico
    r2 = _post_events(c, h, sid, events)
    assert r2.status_code == 200, r2.json()
    rows_after_second = len(_get_events(c, h, sid).json())

    assert rows_after_second == rows_after_first, (
        f"il secondo invio ha aggiunto righe: {rows_after_first} → {rows_after_second}"
    )

    # Lo score in measurements non deve essere raddoppiato
    # SR: num=5, den=10 → 1 + 0.5*9 = 5.5
    expected = round(min(10.0, max(1.0, 1.0 + (5 / 10) * 9.0)), 1)  # 5.5
    m = _get_measurements(c, h, sid).json()[0]
    assert m["scanning_rate"] == pytest.approx(expected, abs=0.05)


# ── Test 3: AGGREGAZIONE MULTI-RIGA ──────────────────────────────────────────

def test_events_aggregation_sums_numerator_denominator(seeded):
    """Tre eventi SR per lo stesso player in un batch: la response POST deve
    restituire UNA riga aggregata con SUM(numerator)/SUM(denominator), mentre
    GET /events deve restituire le 3 righe grezze."""
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]

    sid = _create_session(c, h, gid)

    # 3 ricezioni SR:
    #   (2, 4), (3, 6), (1, 5)  →  SUM = (6, 15)
    #   raw_rate = 6/15 = 0.4
    #   normalized_score = 1 + 0.4*9 = 4.6
    events = [
        {"player_id": pid, "metric_type": "SR", "numerator": 2, "denominator": 4},
        {"player_id": pid, "metric_type": "SR", "numerator": 3, "denominator": 6},
        {"player_id": pid, "metric_type": "SR", "numerator": 1, "denominator": 5},
    ]
    res = _post_events(c, h, sid, events)
    assert res.status_code == 200, res.json()

    data = res.json()
    # La response aggregata ha UNA sola voce per (player, metric)
    assert len(data) == 1, f"attesa 1 riga aggregata, trovate {len(data)}"
    agg = data[0]

    assert agg["numerator"] == 6, f"SUM(numerator) sbagliato: {agg['numerator']}"
    assert agg["denominator"] == 15, f"SUM(denominator) sbagliato: {agg['denominator']}"
    assert agg["raw_rate"] == pytest.approx(6 / 15, abs=0.001)

    expected_score = round(min(10.0, max(1.0, 1.0 + (6 / 15) * 9.0)), 1)  # 4.6
    assert agg["normalized_score"] == pytest.approx(expected_score, abs=0.05)

    # GET /events: deve restituire le 3 righe grezze (audit)
    raw = _get_events(c, h, sid).json()
    assert len(raw) == 3, f"attese 3 righe grezze, trovate {len(raw)}"
    raw_nums = sorted(r["numerator"] for r in raw)
    assert raw_nums == [1, 2, 3]


# ── Test 4: INVARIANTE WRITE-BACK == RESPONSE ────────────────────────────────

def test_events_writeback_score_matches_response_score(seeded):
    """Il valore scritto in measurements deve essere identico al normalized_score
    della response aggregata — le due aggregazioni devono essere coerenti."""
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]

    sid = _create_session(c, h, gid)
    # DQI: decisioni buone=10, osservate=20 → score = 1 + 0.5*9 = 5.5
    res = _post_events(c, h, sid, [
        {"player_id": pid, "metric_type": "DQI", "numerator": 10, "denominator": 20},
    ])
    assert res.status_code == 200, res.json()

    response_score = res.json()[0]["normalized_score"]
    assert response_score is not None, "normalized_score non deve essere None"

    m = _get_measurements(c, h, sid).json()[0]
    assert m["decision_quality"] == pytest.approx(response_score, abs=0.01), (
        f"write-back ({m['decision_quality']}) diverge dalla response ({response_score})"
    )


# ── Test 5: CAMPI NUOVI ───────────────────────────────────────────────────────

def test_events_video_ref_and_codebook_version_accepted(seeded):
    """video_ref e codebook_version vengono accettati dalla API senza errori.

    NOTA: ObservationEventResponse non include questi campi, quindi non sono
    verificabili via risposta HTTP — solo la persistenza è testabile a livello DB.
    Qui verifichiamo che il POST restituisca 200 e che GET /events torni 1 riga
    (prova che la riga è stata scritta nel DB)."""
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]

    sid = _create_session(c, h, gid)
    res = _post_events(c, h, sid, [
        {
            "player_id": pid,
            "metric_type": "SR",
            "numerator": 5,
            "denominator": 10,
            "video_ref": "match_2026-05-01_clip_03.mp4",
            "codebook_version": "v1",
        }
    ])
    assert res.status_code == 200, res.json()

    raw = _get_events(c, h, sid).json()
    assert len(raw) == 1, "la riga deve essere stata persistita"


# ── Test 6: AUDIT — righe grezze via GET ─────────────────────────────────────

def test_events_get_returns_one_raw_row_per_event_not_aggregated(seeded):
    """GET /events è il percorso di audit: restituisce una riga per evento,
    non l'aggregato. POST con 2 eventi per la stessa (player, metric) deve
    lasciare 2 righe grezze distinte."""
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]

    sid = _create_session(c, h, gid)
    # 2 ricezioni SR diverse
    res = _post_events(c, h, sid, [
        {"player_id": pid, "metric_type": "SR", "numerator": 3, "denominator": 6},
        {"player_id": pid, "metric_type": "SR", "numerator": 2, "denominator": 4},
    ])
    assert res.status_code == 200, res.json()

    # POST response: 1 riga aggregata
    post_data = res.json()
    assert len(post_data) == 1, "POST deve restituire 1 riga aggregata"

    # GET response: 2 righe grezze
    raw = _get_events(c, h, sid).json()
    assert len(raw) == 2, f"GET deve restituire 2 righe grezze, trovate {len(raw)}"

    # Valori originali preservati (non modificati dall'aggregazione)
    raw_nums = sorted(r["numerator"] for r in raw)
    raw_dens = sorted(r["denominator"] for r in raw)
    assert raw_nums == [2, 3]
    assert raw_dens == [4, 6]
