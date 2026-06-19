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
from app.schemas.session import MeasurementsBatchInput, SessionCreate, SessionUpdate


class SessionService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(
        self,
        group_id: uuid.UUID | None,
        skip: int,
        limit: int,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> list[TrainingSession]:
        """
        allowed_group_ids=None → nessun filtro (admin/responsabile).
        allowed_group_ids=set  → restringe ai gruppi dell'allenatore.
        Se group_id è specificato ha la precedenza (già validato al livello router).
        """
        q = self.db.query(TrainingSession).filter(TrainingSession.is_active.is_(True))
        if group_id:
            q = q.filter(TrainingSession.group_id == group_id)
        elif allowed_group_ids is not None:
            q = q.filter(TrainingSession.group_id.in_(allowed_group_ids))
        return q.order_by(TrainingSession.session_date.desc()).offset(skip).limit(limit).all()

    def count(
        self,
        group_id: uuid.UUID | None = None,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> int:
        q = self.db.query(func.count(TrainingSession.id)).filter(TrainingSession.is_active.is_(True))
        if group_id:
            q = q.filter(TrainingSession.group_id == group_id)
        elif allowed_group_ids is not None:
            q = q.filter(TrainingSession.group_id.in_(allowed_group_ids))
        return q.scalar() or 0

    def update(self, session_id: uuid.UUID, body: SessionUpdate) -> TrainingSession | None:
        session = self.db.get(TrainingSession, session_id)
        if session is None or not session.is_active:
            return None
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(session, field, value)
        self.db.commit()
        self.db.refresh(session)
        return session

    def deactivate(self, session_id: uuid.UUID) -> bool:
        session = self.db.get(TrainingSession, session_id)
        if session is None or not session.is_active:
            return False
        session.is_active = False
        self.db.commit()
        return True

    def create(self, body: SessionCreate) -> TrainingSession | None:
        """Returns None if no current season or group is found. Raises ValueError if date is outside season range."""
        season = self.db.query(Season).filter(Season.is_current.is_(True)).first()
        if not season:
            return None

        group = self.db.get(Group, body.group_id)
        if not group:
            return None

        if season.start_date and body.session_date < season.start_date:
            raise ValueError(f"La data è precedente all'inizio della stagione ({season.start_date})")
        if season.end_date and body.session_date > season.end_date:
            raise ValueError(f"La data è successiva alla fine della stagione ({season.end_date})")

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

    def get_rankings(
        self,
        session_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> list[dict]:
        _FIELDS = ("scanning_rate", "decision_quality", "anticipation", "transition_reset", "verbal_comm")

        measurements = (
            self.db.query(Measurement)
            .options(joinedload(Measurement.player))
            .filter(Measurement.session_id == session_id, Measurement.is_absent.is_(False))
            .all()
        )

        ranked = []
        for m in measurements:
            vals = [float(getattr(m, f)) for f in _FIELDS if getattr(m, f) is not None]
            if not vals:
                continue
            ranked.append({
                "player_id": m.player_id,
                "first_name": m.player.first_name,
                "last_name": m.player.last_name,
                "avg_score": round(sum(vals) / len(vals), 2),
            })

        ranked.sort(key=lambda x: x["avg_score"], reverse=True)
        total = len(ranked)
        for i, r in enumerate(ranked):
            r["rank"] = i + 1
            r["total"] = total
            r["percentile"] = round((total - i - 1) / total * 100) if total > 1 else 100

        return ranked[skip : skip + limit]

    def get_measurements(self, session_id: uuid.UUID) -> list[Measurement] | None:
        """Returns None if session not found, empty list if no measurements."""
        session = self.get(session_id)
        if session is None:
            return None
        return session.measurements

    def upsert_measurements(
        self, session: TrainingSession, body: MeasurementsBatchInput
    ) -> list[Measurement]:
        """Raises ValueError if any player_id is not found."""
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
                "session_id": session.id,
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

        return self.get_measurements(session.id)
