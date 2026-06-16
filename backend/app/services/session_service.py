from __future__ import annotations

import uuid

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload

from app.models.group import Group
from app.models.measurement import Measurement
from app.models.player import Player
from app.models.season import Season
from app.models.training_session import TrainingSession
from app.schemas.session import MeasurementsBatchInput, SessionCreate


class SessionService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(
        self,
        group_id: uuid.UUID | None,
        skip: int,
        limit: int,
    ) -> list[TrainingSession]:
        q = self.db.query(TrainingSession)
        if group_id:
            q = q.filter(TrainingSession.group_id == group_id)
        return q.order_by(TrainingSession.session_date.desc()).offset(skip).limit(limit).all()

    def create(self, body: SessionCreate) -> TrainingSession | None:
        """Returns None if no current season or group is found."""
        season = self.db.query(Season).filter(Season.is_current.is_(True)).first()
        if not season:
            return None

        group = self.db.get(Group, body.group_id)
        if not group:
            return None

        session = TrainingSession(
            group_id=body.group_id,
            season_id=season.id,
            session_date=body.session_date,
            session_type=body.session_type,
            duration_min=body.duration_min,
            notes=body.notes,
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get(self, session_id: uuid.UUID) -> TrainingSession | None:
        """Eager-loads measurements and their players."""
        return (
            self.db.query(TrainingSession)
            .options(joinedload(TrainingSession.measurements).joinedload(Measurement.player))
            .filter(TrainingSession.id == session_id)
            .first()
        )

    def get_averages(self, session_id: uuid.UUID) -> dict | None:
        if not self.db.get(TrainingSession, session_id):
            return None

        row = (
            self.db.query(
                func.avg(Measurement.scanning_rate).label("avg_sr"),
                func.avg(Measurement.decision_quality).label("avg_dqi"),
                func.avg(Measurement.anticipation).label("avg_ai"),
                func.avg(Measurement.transition_reset).label("avg_trs"),
                func.avg(Measurement.verbal_comm).label("avg_vci"),
                func.count(Measurement.id).label("player_count"),
            )
            .filter(
                Measurement.session_id == session_id,
                Measurement.is_absent.is_(False),
            )
            .first()
        )
        return {
            "avg_sr": float(row.avg_sr) if row.avg_sr is not None else None,
            "avg_dqi": float(row.avg_dqi) if row.avg_dqi is not None else None,
            "avg_ai": float(row.avg_ai) if row.avg_ai is not None else None,
            "avg_trs": float(row.avg_trs) if row.avg_trs is not None else None,
            "avg_vci": float(row.avg_vci) if row.avg_vci is not None else None,
            "player_count": row.player_count or 0,
        }

    def get_measurements(self, session_id: uuid.UUID) -> list[Measurement] | None:
        """Returns None if session not found, empty list if no measurements."""
        session = self.get(session_id)
        if session is None:
            return None
        return session.measurements

    def upsert_measurements(
        self, session_id: uuid.UUID, body: MeasurementsBatchInput
    ) -> list[Measurement] | None:
        """Returns None if session not found, raises ValueError if players missing."""
        session = self.db.get(TrainingSession, session_id)
        if session is None:
            return None

        player_ids = {m.player_id for m in body.measurements}
        found_ids = {
            row.id
            for row in self.db.query(Player.id).filter(Player.id.in_(player_ids)).all()
        }
        missing = player_ids - found_ids
        if missing:
            raise ValueError(f"Giocatori non trovati: {sorted(str(i) for i in missing)}")

        values = [
            {
                "session_id": session_id,
                "player_id": m.player_id,
                "group_id": session.group_id,
                "scanning_rate": m.scanning_rate,
                "decision_quality": m.decision_quality,
                "anticipation": m.anticipation,
                "transition_reset": m.transition_reset,
                "verbal_comm": m.verbal_comm,
                "is_absent": m.is_absent,
                "notes": m.notes,
            }
            for m in body.measurements
        ]

        ins = insert(Measurement)
        stmt = ins.values(values).on_conflict_do_update(
            constraint="uq_measurement_session_player",
            set_={
                "scanning_rate": ins.excluded.scanning_rate,
                "decision_quality": ins.excluded.decision_quality,
                "anticipation": ins.excluded.anticipation,
                "transition_reset": ins.excluded.transition_reset,
                "verbal_comm": ins.excluded.verbal_comm,
                "is_absent": ins.excluded.is_absent,
                "notes": ins.excluded.notes,
            },
        )
        self.db.execute(stmt)
        self.db.commit()

        return self.get_measurements(session_id)
