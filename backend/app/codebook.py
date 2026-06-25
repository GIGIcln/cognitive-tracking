"""Single source of truth for cognitive metric definitions (codebook v1).

Both observation_service.py and the /api/meta/metrics endpoint derive their
configuration from this module.  To add or modify a metric, edit only here.
"""

from __future__ import annotations

METRIC_DEFINITIONS: list[dict] = [
    {
        "field":              "scanning_rate",
        "label":              "SR",
        "italian_label":      "Scanning Rate",
        "avg_key":            "avg_sr",
        "metric_type":        "SR",
        "min_n":              6,
        "reliability_n_basis": "count_rows",   # n = COUNT(rows), one row per reception
        "count_only":         False,
        "numerator_label":    "Check pre-tocco",
        "denominator_label":  "Durata finestra (sec)",
    },
    {
        "field":              "decision_quality",
        "label":              "DQI",
        "italian_label":      "Dec. Quality",
        "avg_key":            "avg_dqi",
        "metric_type":        "DQI",
        "min_n":              20,
        "reliability_n_basis": "denominator",
        "count_only":         False,
        "numerator_label":    "Decisioni corrette",
        "denominator_label":  "Decision points",
    },
    {
        "field":              "anticipation",
        "label":              "AI",
        "italian_label":      "Anticipazione",
        "avg_key":            "avg_ai",
        "metric_type":        "AI",
        "min_n":              None,             # uses fixed thresholds: 3/6/10
        "reliability_n_basis": "numerator",
        "count_only":         True,
        "numerator_label":    "Movimenti anticipatori",
        "denominator_label":  None,
    },
    {
        "field":              "transition_reset",
        "label":              "TRS",
        "italian_label":      "Trans. Reset",
        "avg_key":            "avg_trs",
        "metric_type":        "TRS",
        "min_n":              10,
        "reliability_n_basis": "denominator",
        "count_only":         False,
        "numerator_label":    "Reset nei tempi",
        "denominator_label":  "Transizioni osservate",
    },
    {
        "field":              "verbal_comm",
        "label":              "VCI",
        "italian_label":      "Comunicazione",
        "avg_key":            "avg_vci",
        "metric_type":        "VCI",
        "min_n":              8,
        "reliability_n_basis": "denominator",
        "count_only":         False,
        "numerator_label":    "Comunicazioni rilevanti",
        "denominator_label":  "Minuti osservati",
    },
]

# Derived lookups used by observation_service.py
METRIC_MIN_N: dict[str, int] = {
    m["metric_type"]: m["min_n"]
    for m in METRIC_DEFINITIONS
    if m["min_n"] is not None
}

METRIC_TO_FIELD: dict[str, str] = {
    m["metric_type"]: m["field"]
    for m in METRIC_DEFINITIONS
}
