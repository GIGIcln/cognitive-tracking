"""Integration tests for POST/GET /api/sessions/{sid}/events.

All tests use the `seeded` fixture (SQLite, one player, admin auth) because
the new delete-then-insert strategy is standard SQL — no PostgreSQL-specific
features required.
"""

import pytest
from app.services.observation_service import reliability_flag

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
    """video_ref e codebook_version sono esposti nella response GET /events (audit)
    e, per l'aggregato POST, video_ref=None e codebook_version='v1' (versione unica)."""
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

    # POST response (aggregata): video_ref=None, codebook_version="v1" (versione unica)
    agg = res.json()[0]
    assert agg["video_ref"] is None
    assert agg["codebook_version"] == "v1"

    # GET response (audit): i campi originali devono essere presenti
    raw = _get_events(c, h, sid).json()
    assert len(raw) == 1, "la riga deve essere stata persistita"
    assert raw[0]["video_ref"] == "match_2026-05-01_clip_03.mp4"
    assert raw[0]["codebook_version"] == "v1"


def test_events_aggregated_response_exposes_shared_codebook_version(seeded):
    """POST con più righe che condividono la stessa codebook_version:
    la response aggregata espone codebook_version='v1' e video_ref=None."""
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]

    sid = _create_session(c, h, gid)
    res = _post_events(c, h, sid, [
        {"player_id": pid, "metric_type": "SR", "numerator": 3, "denominator": 6,
         "codebook_version": "v1", "video_ref": "clip_a.mp4"},
        {"player_id": pid, "metric_type": "SR", "numerator": 2, "denominator": 4,
         "codebook_version": "v1", "video_ref": "clip_b.mp4"},
    ])
    assert res.status_code == 200, res.json()

    agg = res.json()[0]
    assert agg["video_ref"] is None, "video_ref aggregato deve essere None"
    assert agg["codebook_version"] == "v1", "versione unica deve essere esposta"


def test_events_aggregated_codebook_version_none_when_mixed(seeded):
    """POST con due righe della stessa coppia (player, metric) ma codebook_version
    diverse: la response aggregata deve avere codebook_version=None."""
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]

    sid = _create_session(c, h, gid)
    res = _post_events(c, h, sid, [
        {"player_id": pid, "metric_type": "SR", "numerator": 3, "denominator": 6,
         "codebook_version": "v1"},
        {"player_id": pid, "metric_type": "SR", "numerator": 2, "denominator": 4,
         "codebook_version": "v2"},
    ])
    assert res.status_code == 200, res.json()

    agg = res.json()[0]
    assert agg["codebook_version"] is None, (
        f"versioni miste devono dare codebook_version=None, trovato '{agg['codebook_version']}'"
    )


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


# ── Test 7: SR RELIABILITY — COUNT-BASED ─────────────────────────────────────

def test_sr_reliability_insufficient_when_few_events_many_seconds(seeded):
    """Bug-pin: 2 ricezioni SR con molti secondi totali devono dare 'insufficient'.
    Il denominator elevato (=secondi) NON deve salvare il flag — la reliability
    è ora basata su COUNT(righe), non sulla somma dei secondi."""
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]

    sid = _create_session(c, h, gid)
    # den totale = 40 secondi, ma solo 2 righe → n=2 < half(3) → "insufficient"
    res = _post_events(c, h, sid, [
        {"player_id": pid, "metric_type": "SR", "numerator": 8, "denominator": 20},
        {"player_id": pid, "metric_type": "SR", "numerator": 5, "denominator": 20},
    ])
    assert res.status_code == 200, res.json()
    flag = res.json()[0]["reliability_flag"]
    assert flag == "insufficient", (
        f"2 ricezioni con den totale=40 deve dare 'insufficient', trovato '{flag}'"
    )


def test_sr_reliability_boundaries(seeded):
    """Bande SR con min_n=6: <3 insufficient, 3-5 low, 6-11 medium, ≥12 high.
    Copre tutti i confini di banda."""
    c, h = seeded["client"], seeded["headers"]
    gid, pid = seeded["group_id"], seeded["player_id"]

    cases = [
        (2,  "insufficient"),
        (3,  "low"),
        (5,  "low"),
        (6,  "medium"),
        (11, "medium"),
        (12, "high"),
    ]
    for count, expected in cases:
        sid = _create_session(c, h, gid)
        res = _post_events(c, h, sid, [
            {"player_id": pid, "metric_type": "SR", "numerator": 1, "denominator": 3}
            for _ in range(count)
        ])
        assert res.status_code == 200, res.json()
        flag = res.json()[0]["reliability_flag"]
        assert flag == expected, (
            f"{count} ricezioni deve dare '{expected}', trovato '{flag}'"
        )


# ── Test 8: NON-REGRESSIONE DQI/TRS/VCI/AI ───────────────────────────────────

def test_reliability_non_regression_dqi_trs_vci_ai():
    """DQI/TRS/VCI usano ancora denominator, AI usa ancora numerator.
    Soglie immutate rispetto a prima della modifica SR."""

    # DQI: min_n=20, half=10
    assert reliability_flag("DQI", 9)  == "insufficient"  # 9 < 10
    assert reliability_flag("DQI", 10) == "low"           # 10 < 20
    assert reliability_flag("DQI", 25) == "medium"        # 20 ≤ 25 < 40
    assert reliability_flag("DQI", 40) == "high"          # ≥ 40

    # TRS: min_n=10, half=5
    assert reliability_flag("TRS", 4)  == "insufficient"  # 4 < 5
    assert reliability_flag("TRS", 5)  == "low"           # 5 < 10
    assert reliability_flag("TRS", 15) == "medium"        # 10 ≤ 15 < 20
    assert reliability_flag("TRS", 20) == "high"          # ≥ 20

    # VCI: min_n=8, half=4
    assert reliability_flag("VCI", 3)  == "insufficient"  # 3 < 4
    assert reliability_flag("VCI", 4)  == "low"           # 4 < 8
    assert reliability_flag("VCI", 10) == "medium"        # 8 ≤ 10 < 16
    assert reliability_flag("VCI", 16) == "high"          # ≥ 16

    # AI: soglie 3/6/10 invariate
    assert reliability_flag("AI", 2)  == "insufficient"   # 2 < 3
    assert reliability_flag("AI", 3)  == "low"            # 3 < 6
    assert reliability_flag("AI", 6)  == "medium"         # 6 < 10
    assert reliability_flag("AI", 10) == "high"           # ≥ 10
