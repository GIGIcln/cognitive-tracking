from __future__ import annotations

import uuid
from datetime import date, datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session

from app.models.group_target import GroupTarget
from app.services.group_service import GroupService
from app.services.player_service import PlayerService
from app.services.session_service import SessionService

TEMPLATE_DIR = Path(__file__).parent.parent / "templates"

_jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=True)

# param abbreviation → db field name
_ABBREV_TO_FIELD: dict[str, str] = {
    "SR": "scanning_rate",
    "DQI": "decision_quality",
    "AI": "anticipation",
    "TRS": "transition_reset",
    "VCI": "verbal_comm",
}

_PARAMS: list[tuple[str, str, str]] = [
    ("scanning_rate", "SR", "Scanning Rate"),
    ("decision_quality", "DQI", "Decision Quality"),
    ("anticipation", "AI", "Anticipation"),
    ("transition_reset", "TRS", "Transition Reset"),
    ("verbal_comm", "VCI", "Verbal Comm."),
]

_AVG_KEYS: dict[str, str] = {
    "scanning_rate": "avg_sr",
    "decision_quality": "avg_dqi",
    "anticipation": "avg_ai",
    "transition_reset": "avg_trs",
    "verbal_comm": "avg_vci",
}


def _build_targets_map(targets: list[GroupTarget]) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for t in targets:
        field = _ABBREV_TO_FIELD.get(t.parameter)
        if field:
            result[field] = {
                "insuf_max": float(t.insufficient_max),
                "ottimo_min": float(t.ottimo_min),
            }
    return result


def _score_class(value: float | None, field: str, targets_map: dict) -> str:
    if value is None:
        return "null"
    t = targets_map.get(field)
    if not t:
        return "neutral"
    if value <= t["insuf_max"]:
        return "bad"
    if value >= t["ottimo_min"]:
        return "good"
    return "mid"


def _sparkline_svg(
    scores: list[float | None],
    insuf_max: float | None,
    ottimo_min: float | None,
    width: int = 280,
    height: int = 80,
) -> str:
    PX, PY = 10, 8
    IW = width - 2 * PX
    IH = height - 2 * PY

    def sx(i: int, n: int) -> float:
        return PX + (i / max(n - 1, 1)) * IW

    def sy(s: float) -> float:
        return PY + (10.0 - s) / 10.0 * IH

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" style="display:block">'
    ]

    if ottimo_min is not None:
        y1 = sy(ottimo_min)
        if y1 > PY:
            parts.append(
                f'<rect x="{PX}" y="{PY}" width="{IW}" '
                f'height="{y1 - PY:.1f}" fill="#d1fae5" opacity="0.85"/>'
            )
    if insuf_max is not None:
        y0 = sy(insuf_max)
        y1 = PY + IH
        if y1 > y0:
            parts.append(
                f'<rect x="{PX}" y="{y0:.1f}" width="{IW}" '
                f'height="{y1 - y0:.1f}" fill="#fee2e2" opacity="0.85"/>'
            )

    parts.append(
        f'<rect x="{PX}" y="{PY}" width="{IW}" height="{IH}" '
        f'fill="none" stroke="#e5e7eb" stroke-width="0.5"/>'
    )

    valid = [(i, s) for i, s in enumerate(scores) if s is not None]
    n = len(scores)

    if valid:
        if len(valid) > 1:
            pts = " ".join(f"{sx(i, n):.1f},{sy(s):.1f}" for i, s in valid)
            parts.append(
                f'<polyline points="{pts}" fill="none" stroke="#2563eb" '
                f'stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>'
            )
        for idx, (i, s) in enumerate(valid):
            cx, cy = sx(i, n), sy(s)
            is_last = idx == len(valid) - 1
            r = "3.5" if is_last else "2"
            fill = "#1d4ed8" if is_last else "#93c5fd"
            parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{fill}"/>')
            if is_last:
                tx = min(cx + 4, width - 22)
                ty = max(cy - 3, PY + 8)
                parts.append(
                    f'<text x="{tx:.1f}" y="{ty:.1f}" font-size="8" '
                    f'font-weight="600" fill="#1d4ed8">{s:.1f}</text>'
                )
    else:
        parts.append(
            f'<text x="{width // 2}" y="{height // 2 + 3}" '
            f'text-anchor="middle" font-size="9" fill="#9ca3af">—</text>'
        )

    parts.append("</svg>")
    return "".join(parts)


def _bar_chart_svg(
    averages: dict[str, float | None],
    targets_map: dict,
    width: int = 280,
    height: int = 160,
) -> str:
    PL, PR, PT, PB = 34, 10, 8, 8
    n = len(_PARAMS)
    row_h = (height - PT - PB) / n
    bar_h = row_h * 0.55
    bar_max_w = width - PL - PR

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" style="display:block">'
    ]

    for i, (field, abbrev, _) in enumerate(_PARAMS):
        yc = PT + i * row_h + row_h / 2
        yb = yc - bar_h / 2
        val = averages.get(field)
        t = targets_map.get(field, {})
        insuf = t.get("insuf_max")
        ottimo = t.get("ottimo_min")

        parts.append(
            f'<text x="{PL - 4}" y="{yc + 3:.1f}" text-anchor="end" '
            f'font-size="9" font-weight="600" fill="#374151">{abbrev}</text>'
        )
        parts.append(
            f'<rect x="{PL}" y="{yb:.1f}" width="{bar_max_w}" '
            f'height="{bar_h:.1f}" fill="#f3f4f6" rx="2"/>'
        )

        if val is not None:
            bw = max((val / 10.0) * bar_max_w, 0)
            if insuf is not None and val <= insuf:
                color = "#ef4444"
            elif ottimo is not None and val >= ottimo:
                color = "#22c55e"
            else:
                color = "#f59e0b"
            parts.append(
                f'<rect x="{PL}" y="{yb:.1f}" width="{bw:.1f}" '
                f'height="{bar_h:.1f}" fill="{color}" rx="2" opacity="0.85"/>'
            )
            tx = PL + bw + 3
            parts.append(
                f'<text x="{tx:.1f}" y="{yc + 3:.1f}" font-size="8.5" '
                f'font-weight="600" fill="{color}">{val:.1f}</text>'
            )

        if insuf is not None:
            xi = PL + (insuf / 10.0) * bar_max_w
            parts.append(
                f'<line x1="{xi:.1f}" y1="{yb:.1f}" x2="{xi:.1f}" y2="{yb + bar_h:.1f}" '
                f'stroke="#dc2626" stroke-width="1.5" stroke-dasharray="2,1"/>'
            )
        if ottimo is not None:
            xo = PL + (ottimo / 10.0) * bar_max_w
            parts.append(
                f'<line x1="{xo:.1f}" y1="{yb:.1f}" x2="{xo:.1f}" y2="{yb + bar_h:.1f}" '
                f'stroke="#16a34a" stroke-width="1.5" stroke-dasharray="2,1"/>'
            )

    parts.append("</svg>")
    return "".join(parts)


def _add_row_classes(rows: list[dict], targets_map: dict) -> list[dict]:
    result = []
    for row in rows:
        classes = {field: _score_class(row.get(field), field, targets_map) for field, _, _ in _PARAMS}
        result.append({**row, "classes": classes})
    return result


def _format_date(d: date | datetime | None) -> str:
    if d is None:
        return "—"
    if isinstance(d, (date, datetime)):
        return d.strftime("%d/%m/%Y")
    return str(d)


def build_player_report(player_id: uuid.UUID, db: Session) -> dict | None:
    ps = PlayerService(db)
    ss = SessionService(db)
    gs = GroupService(db)

    player = ps.get(player_id)
    if not player:
        return None

    history = ps.get_history(player_id, limit=30)
    if not history:
        return None

    last = history[-1]
    group_id = last["group_id"]
    targets_raw = gs.get_targets(group_id) or []
    targets_map = _build_targets_map(targets_raw)

    last_session_id = last["session_id"]
    last_avg = ss.get_averages(last_session_id)
    rankings = ss.get_rankings(last_session_id)
    ranking = next((r for r in rankings if r["player_id"] == player_id), None)

    recent = history[-12:]
    charts: dict[str, dict] = {}
    for field, abbrev, label in _PARAMS:
        scores = [row.get(field) for row in recent]
        t = targets_map.get(field, {})
        latest = next((s for s in reversed(scores) if s is not None), None)
        charts[field] = {
            "abbrev": abbrev,
            "label": label,
            "svg": _sparkline_svg(scores, t.get("insuf_max"), t.get("ottimo_min")),
            "latest": latest,
            "cls": _score_class(latest, field, targets_map),
        }

    history_with_classes = _add_row_classes(recent, targets_map)

    if last_avg:
        avg_with_classes = {
            **last_avg,
            "classes": {
                field: _score_class(last_avg.get(_AVG_KEYS[field]), field, targets_map)
                for field, _, _ in _PARAMS
            },
        }
    else:
        avg_with_classes = None

    return {
        "player": player,
        "group_name": last.get("group_name", ""),
        "history": history_with_classes,
        "charts": charts,
        "targets_map": targets_map,
        "last_avg": avg_with_classes,
        "ranking": ranking,
        "generated_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "format_date": _format_date,
        "avg_keys": _AVG_KEYS,
    }


def build_team_report(group_id: uuid.UUID, db: Session) -> dict | None:
    gs = GroupService(db)
    ss = SessionService(db)

    group, _ = gs.get(group_id)
    if not group:
        return None

    history = gs.get_history(group_id, limit=30)
    if not history:
        return None

    targets_raw = gs.get_targets(group_id) or []
    targets_map = _build_targets_map(targets_raw)

    last = history[-1]
    last_session_id = last["session_id"]

    measurements_raw = ss.get_measurements(last_session_id) or []
    player_rows: list[dict] = []
    for m in measurements_raw:
        if m.is_absent:
            continue
        row: dict = {
            "first_name": m.player.first_name if m.player else "—",
            "last_name": m.player.last_name if m.player else "—",
            "scanning_rate": float(m.scanning_rate) if m.scanning_rate is not None else None,
            "decision_quality": float(m.decision_quality) if m.decision_quality is not None else None,
            "anticipation": float(m.anticipation) if m.anticipation is not None else None,
            "transition_reset": float(m.transition_reset) if m.transition_reset is not None else None,
            "verbal_comm": float(m.verbal_comm) if m.verbal_comm is not None else None,
        }
        vals = [v for v in row.values() if isinstance(v, float)]
        row["avg"] = round(sum(vals) / len(vals), 2) if vals else None
        player_rows.append(row)

    player_rows.sort(key=lambda r: (r["avg"] or 0), reverse=True)
    player_rows_with_classes = _add_row_classes(player_rows, targets_map)

    recent = history[-12:]
    team_avg = {
        field: next(
            (row.get(_AVG_KEYS[field]) for row in reversed(recent) if row.get(_AVG_KEYS[field]) is not None),
            None,
        )
        for field, _, _ in _PARAMS
    }

    charts: dict[str, dict] = {}
    for field, abbrev, label in _PARAMS:
        scores = [row.get(_AVG_KEYS[field]) for row in recent]
        t = targets_map.get(field, {})
        latest = team_avg[field]
        charts[field] = {
            "abbrev": abbrev,
            "label": label,
            "svg": _sparkline_svg(scores, t.get("insuf_max"), t.get("ottimo_min")),
            "latest": latest,
            "cls": _score_class(latest, field, targets_map),
        }

    bar_chart_svg = _bar_chart_svg(team_avg, targets_map)

    history_with_classes = []
    for row in recent:
        team_row = {
            "session_date": row["session_date"],
            "session_type": row["session_type"],
            "player_count": row["player_count"],
        }
        for field, _, _ in _PARAMS:
            team_row[field] = row.get(_AVG_KEYS[field])
        classes = {field: _score_class(team_row.get(field), field, targets_map) for field, _, _ in _PARAMS}
        history_with_classes.append({**team_row, "classes": classes})

    season_name = group.season.name if group.season else ""

    return {
        "group": group,
        "season_name": season_name,
        "history": history_with_classes,
        "charts": charts,
        "targets_map": targets_map,
        "player_rows": player_rows_with_classes,
        "bar_chart_svg": bar_chart_svg,
        "generated_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "format_date": _format_date,
    }


def render_player_report_pdf(player_id: uuid.UUID, db: Session) -> bytes | None:
    data = build_player_report(player_id, db)
    if data is None:
        return None
    template = _jinja_env.get_template("player_report.html")
    html = template.render(**data)
    from weasyprint import HTML  # lazy import — system libs required at runtime

    return HTML(string=html, base_url=str(TEMPLATE_DIR)).write_pdf()


def render_team_report_pdf(group_id: uuid.UUID, db: Session) -> bytes | None:
    data = build_team_report(group_id, db)
    if data is None:
        return None
    template = _jinja_env.get_template("team_report.html")
    html = template.render(**data)
    from weasyprint import HTML  # lazy import — system libs required at runtime

    return HTML(string=html, base_url=str(TEMPLATE_DIR)).write_pdf()
