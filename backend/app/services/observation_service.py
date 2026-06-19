from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.measurement import Measurement
from app.models.observation_event import ObservationEvent
from app.schemas.observation_event import ObservationEventResponse, ObservationEventsBatchInput

# Minimum denominator (or numerator for AI) before the data is considered reliable.
_METRIC_MIN_N: dict[str, int] = {
    "SR": 6,    # SR: numero di RICEZIONI (COUNT righe), non secondi.
    "DQI": 20,
    "TRS": 10,
    "VCI": 8,   # denominator = minutes observed
    # AI uses numerator as sample size; thresholds set in reliability_flag below
}

# Maps metric label → Measurement column name
_METRIC_TO_FIELD: dict[str, str] = {
    "SR": "scanning_rate",
    "DQI": "decision_quality",
    "AI": "anticipation",
    "TRS": "transition_reset",
    "VCI": "verbal_comm",
}


def reliability_flag(metric: str, n: int) -> str:
    """Return 'insufficient' | 'low' | 'medium' | 'high'."""
    if metric == "AI":
        if n < 3:  return "insufficient"
        if n < 6:  return "low"
        if n < 10: return "medium"
        return "high"

    min_n = _METRIC_MIN_N[metric]
    half = min_n // 2
    if n < half:      return "insufficient"
    if n < min_n:     return "low"
    if n < min_n * 2: return "medium"
    return "high"


def normalized_score(metric: str, numerator: int, denominator: int) -> float | None:
    """Derive a 1–10 score from raw event counts.

    SR / DQI / TRS — percentage metrics:
        rate = numerator / denominator   (0 → 1.0,  1 → 10.0)

    AI — absolute count metric:
        count = numerator  (0 → 1.0,  10+ → 10.0)

    VCI — frequency metric (events per minute observed):
        rate = numerator / denominator   (0 → 1.0,  2+ /min → 10.0)
    """
    if metric in ("SR", "DQI", "TRS"):
        if denominator == 0:
            return None
        rate = numerator / denominator
        return round(min(10.0, max(1.0, 1.0 + rate * 9.0)), 1)

    if metric == "AI":
        if numerator == 0:
            return 1.0
        return round(min(10.0, max(1.0, 1.0 + numerator * 0.9)), 1)

    if metric == "VCI":
        if denominator == 0:
            return None
        rate_per_min = numerator / denominator
        return round(min(10.0, max(1.0, 1.0 + (rate_per_min / 2.0) * 9.0)), 1)

    return None


def event_to_response(event: ObservationEvent) -> ObservationEventResponse:
    """Convert a single raw row to a response — used by GET /events for audit access."""
    raw: float | None = (
        event.numerator / event.denominator if event.denominator > 0 else None
    )
    # For AI: n = successes; for SR: n = 1 (single raw row = 1 reception); others: denominator
    n = 1 if event.metric_type == "SR" else (event.numerator if event.metric_type == "AI" else event.denominator)
    return ObservationEventResponse(
        id=event.id,
        player_id=event.player_id,
        first_name=event.player.first_name,
        last_name=event.player.last_name,
        metric_type=event.metric_type,
        numerator=event.numerator,
        denominator=event.denominator,
        raw_rate=round(raw, 3) if raw is not None else None,
        n_events=n,
        reliability_flag=reliability_flag(event.metric_type, n),
        normalized_score=normalized_score(event.metric_type, event.numerator, event.denominator),
        method=event.method,
        observer_notes=event.observer_notes,
        video_ref=event.video_ref,
        codebook_version=event.codebook_version,
    )


def aggregate_events_to_responses(events: list[ObservationEvent]) -> list[ObservationEventResponse]:
    """Aggregate raw event rows by (player_id, metric_type) → one response per group.

    Derivation formulas and reliability thresholds are unchanged — they receive the
    same scalar inputs as before, now computed as SUM across all rows in the group.
    """
    groups: dict[tuple, list[ObservationEvent]] = defaultdict(list)
    for ev in events:
        groups[(ev.player_id, ev.metric_type)].append(ev)

    responses: list[ObservationEventResponse] = []
    for (player_id, metric_type), rows in groups.items():
        agg_num = sum(r.numerator for r in rows)
        agg_den = sum(r.denominator for r in rows)
        raw: float | None = agg_num / agg_den if agg_den > 0 else None
        n = len(rows) if metric_type == "SR" else (agg_num if metric_type == "AI" else agg_den)
        last = rows[-1]
        versions = {r.codebook_version for r in rows}
        agg_codebook_version = next(iter(versions)) if len(versions) == 1 else None
        responses.append(ObservationEventResponse(
            id=last.id,
            player_id=player_id,
            first_name=last.player.first_name,
            last_name=last.player.last_name,
            metric_type=metric_type,
            numerator=agg_num,
            denominator=agg_den,
            raw_rate=round(raw, 3) if raw is not None else None,
            n_events=n,
            reliability_flag=reliability_flag(metric_type, n),
            normalized_score=normalized_score(metric_type, agg_num, agg_den),
            method=last.method,
            observer_notes=last.observer_notes,
            video_ref=None,
            codebook_version=agg_codebook_version,
        ))
    return responses


class ObservationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def upsert_events(
        self,
        session_id: uuid.UUID,
        group_id: uuid.UUID,
        batch: ObservationEventsBatchInput,
    ) -> list[ObservationEvent]:
        """Idempotent batch save: delete existing rows for each (player, metric) pair
        in the batch, then insert all incoming rows fresh.  Multiple rows per pair
        are supported — the table is now append-only with no UNIQUE constraint."""

        # 1. Delete previous rows only for the (player_id, metric_type) pairs in this batch
        keys = {(ev.player_id, ev.metric_type) for ev in batch.events}
        for player_id, metric_type in keys:
            self.db.query(ObservationEvent).filter(
                ObservationEvent.session_id == session_id,
                ObservationEvent.player_id == player_id,
                ObservationEvent.metric_type == metric_type,
            ).delete(synchronize_session=False)

        # 2. Insert all incoming rows as new events
        for ev in batch.events:
            self.db.add(ObservationEvent(
                session_id=session_id,
                player_id=ev.player_id,
                group_id=group_id,
                metric_type=ev.metric_type,
                numerator=ev.numerator,
                denominator=ev.denominator,
                method=ev.method,
                observer_notes=ev.observer_notes,
                video_ref=ev.video_ref,
                codebook_version=ev.codebook_version,
            ))

        self.db.flush()

        # 3. Write derived scores back to measurements using AGGREGATED batch values.
        #    We aggregate from batch.events (the data we just inserted for these pairs).
        #    Other (player, metric) pairs already in measurements are untouched.
        player_metric_agg: dict[tuple, dict[str, int]] = defaultdict(lambda: {"num": 0, "den": 0})
        for ev in batch.events:
            key = (ev.player_id, ev.metric_type)
            player_metric_agg[key]["num"] += ev.numerator
            player_metric_agg[key]["den"] += ev.denominator

        player_updates: dict[uuid.UUID, dict[str, float]] = defaultdict(dict)
        for (player_id, metric_type), agg in player_metric_agg.items():
            score = normalized_score(metric_type, agg["num"], agg["den"])
            if score is not None:
                player_updates[player_id][_METRIC_TO_FIELD[metric_type]] = score

        for player_id, updates in player_updates.items():
            existing = (
                self.db.query(Measurement)
                .filter(
                    Measurement.session_id == session_id,
                    Measurement.player_id == player_id,
                )
                .first()
            )
            if existing:
                for field, value in updates.items():
                    setattr(existing, field, value)
            else:
                self.db.add(Measurement(
                    session_id=session_id,
                    player_id=player_id,
                    group_id=group_id,
                    **updates,
                ))

        self.db.commit()

        return (
            self.db.query(ObservationEvent)
            .filter(ObservationEvent.session_id == session_id)
            .all()
        )

    def get_events(self, session_id: uuid.UUID) -> list[ObservationEvent]:
        """Return all raw event rows for a session (audit access)."""
        return (
            self.db.query(ObservationEvent)
            .filter(ObservationEvent.session_id == session_id)
            .all()
        )
