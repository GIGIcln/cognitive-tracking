from __future__ import annotations

import uuid

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.measurement import Measurement
from app.models.observation_event import ObservationEvent
from app.schemas.observation_event import ObservationEventResponse, ObservationEventsBatchInput

# Minimum denominator (or numerator for AI) before the data is considered reliable.
_METRIC_MIN_N: dict[str, int] = {
    "SR": 15,
    "DQI": 20,
    "TRS": 10,
    "VCI": 8,   # denominator = minutes observed
    # AI uses numerator as sample size; thresholds set in _reliability_flag below
}

# Maps metric label → Measurement column name
_METRIC_TO_FIELD: dict[str, str] = {
    "SR": "scanning_rate",
    "DQI": "decision_quality",
    "AI": "anticipation",
    "TRS": "transition_reset",
    "VCI": "verbal_comm",
}


def reliability_flag(metric: str, numerator: int, denominator: int) -> str:
    """Return 'insufficient' | 'low' | 'medium' | 'high'."""
    if metric == "AI":
        # AI is count-only; reliability based on number of recognized moves
        n = numerator
        if n < 3:  return "insufficient"
        if n < 6:  return "low"
        if n < 10: return "medium"
        return "high"

    min_n = _METRIC_MIN_N[metric]
    half = min_n // 2
    if denominator < half:      return "insufficient"
    if denominator < min_n:     return "low"
    if denominator < min_n * 2: return "medium"
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
    raw: float | None = (
        event.numerator / event.denominator if event.denominator > 0 else None
    )
    # For AI, meaningful n is the numerator (count), not the denominator
    n = event.numerator if event.metric_type == "AI" else event.denominator
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
        reliability_flag=reliability_flag(event.metric_type, event.numerator, event.denominator),
        normalized_score=normalized_score(event.metric_type, event.numerator, event.denominator),
        method=event.method,
        observer_notes=event.observer_notes,
    )


class ObservationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def upsert_events(
        self,
        session_id: uuid.UUID,
        group_id: uuid.UUID,
        batch: ObservationEventsBatchInput,
    ) -> list[ObservationEvent]:
        # Upsert each event row
        for ev in batch.events:
            stmt = (
                pg_insert(ObservationEvent)
                .values(
                    session_id=session_id,
                    player_id=ev.player_id,
                    group_id=group_id,
                    metric_type=ev.metric_type,
                    numerator=ev.numerator,
                    denominator=ev.denominator,
                    method=ev.method,
                    observer_notes=ev.observer_notes,
                )
                .on_conflict_do_update(
                    constraint="uq_observation_session_player_metric",
                    set_={
                        "numerator": ev.numerator,
                        "denominator": ev.denominator,
                        "method": ev.method,
                        "observer_notes": ev.observer_notes,
                    },
                )
            )
            self.db.execute(stmt)

        self.db.flush()

        # Write back derived scores into the measurements table
        player_events: dict[uuid.UUID, list] = {}
        for ev in batch.events:
            player_events.setdefault(ev.player_id, []).append(ev)

        for player_id, evs in player_events.items():
            updates: dict[str, float] = {}
            for ev in evs:
                score = normalized_score(ev.metric_type, ev.numerator, ev.denominator)
                if score is not None:
                    updates[_METRIC_TO_FIELD[ev.metric_type]] = score

            if not updates:
                continue

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
                self.db.add(
                    Measurement(
                        session_id=session_id,
                        player_id=player_id,
                        group_id=group_id,
                        **updates,
                    )
                )

        self.db.commit()

        return (
            self.db.query(ObservationEvent)
            .filter(ObservationEvent.session_id == session_id)
            .all()
        )

    def get_events(self, session_id: uuid.UUID) -> list[ObservationEvent]:
        return (
            self.db.query(ObservationEvent)
            .filter(ObservationEvent.session_id == session_id)
            .all()
        )
