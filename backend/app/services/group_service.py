from __future__ import annotations

import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.group import Group
from app.models.group_target import GroupTarget
from app.models.measurement import Measurement
from app.models.training_session import TrainingSession
from app.schemas.group import TargetUpdateItem


class GroupService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_history(self, group_id: uuid.UUID, limit: int = 60) -> list[dict]:
        rows = (
            self.db.query(
                TrainingSession.id.label("session_id"),
                TrainingSession.session_date,
                TrainingSession.session_type,
                func.avg(Measurement.scanning_rate).label("avg_sr"),
                func.avg(Measurement.decision_quality).label("avg_dqi"),
                func.avg(Measurement.anticipation).label("avg_ai"),
                func.avg(Measurement.transition_reset).label("avg_trs"),
                func.avg(Measurement.verbal_comm).label("avg_vci"),
                func.count(Measurement.id).label("player_count"),
            )
            .outerjoin(
                Measurement,
                (Measurement.session_id == TrainingSession.id)
                & Measurement.is_absent.is_(False),
            )
            .filter(TrainingSession.group_id == group_id)
            .group_by(
                TrainingSession.id,
                TrainingSession.session_date,
                TrainingSession.session_type,
            )
            .order_by(TrainingSession.session_date.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "session_id": str(r.session_id),
                "session_date": str(r.session_date),
                "session_type": r.session_type,
                "avg_sr": float(r.avg_sr) if r.avg_sr is not None else None,
                "avg_dqi": float(r.avg_dqi) if r.avg_dqi is not None else None,
                "avg_ai": float(r.avg_ai) if r.avg_ai is not None else None,
                "avg_trs": float(r.avg_trs) if r.avg_trs is not None else None,
                "avg_vci": float(r.avg_vci) if r.avg_vci is not None else None,
                "player_count": r.player_count or 0,
            }
            for r in reversed(rows)
        ]

    def update_targets(
        self, group_id: uuid.UUID, body: list[TargetUpdateItem]
    ) -> list[GroupTarget] | None:
        """Returns None if group not found."""
        group = self.db.get(Group, group_id)
        if not group:
            return None

        existing = {t.parameter: t for t in group.targets}
        for item in body:
            if item.parameter in existing:
                target = existing[item.parameter]
                target.insufficient_max = item.insufficient_max
                target.ottimo_min = item.ottimo_min
            else:
                self.db.add(GroupTarget(
                    group_id=group_id,
                    parameter=item.parameter,
                    insufficient_max=item.insufficient_max,
                    ottimo_min=item.ottimo_min,
                ))

        self.db.commit()
        self.db.refresh(group)
        return group.targets
