from __future__ import annotations

import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.assignment import PlayerGroupAssignment
from app.models.group import Group
from app.models.group_change_log import GroupChangeLog
from app.models.group_target import GroupTarget
from app.models.measurement import Measurement
from app.models.player import Player
from app.models.season import Season
from app.models.training_session import TrainingSession
from app.schemas.group import GroupCreate, GroupUpdate, TargetUpdateItem

TRACKED_FIELDS = {"level", "category", "birth_year", "sub_group", "max_players", "name"}


class GroupService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _current_season(self) -> Season | None:
        return self.db.query(Season).filter(Season.is_current.is_(True)).first()

    def list(self, scope: list[uuid.UUID] | None) -> list[Group]:
        season = self._current_season()
        if not season:
            return []
        q = (
            self.db.query(Group)
            .filter(Group.season_id == season.id, Group.is_active.is_(True))
            .order_by(Group.birth_year.desc(), Group.sub_group.asc())
        )
        if scope is not None:
            q = q.filter(Group.id.in_(scope))
        return q.all()

    def get(self, group_id: uuid.UUID) -> tuple[Group, list[PlayerGroupAssignment]] | tuple[None, None]:
        group = (
            self.db.query(Group)
            .options(joinedload(Group.targets))
            .filter(Group.id == group_id)
            .first()
        )
        if not group:
            return None, None
        assignments = (
            self.db.query(PlayerGroupAssignment)
            .options(joinedload(PlayerGroupAssignment.player))
            .filter(
                PlayerGroupAssignment.group_id == group_id,
                PlayerGroupAssignment.is_current.is_(True),
            )
            .all()
        )
        return group, assignments

    def get_targets(self, group_id: uuid.UUID) -> list[GroupTarget] | None:
        group = self.db.get(Group, group_id)
        if not group:
            return None
        return group.targets

    def create(self, body: GroupCreate) -> Group | None:
        season = self._current_season()
        if not season:
            return None
        group = Group(
            season_id=season.id,
            name=body.name,
            category=body.category,
            birth_year=body.birth_year,
            level=body.level,
            sub_group=body.sub_group,
            max_players=body.max_players,
        )
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def update(self, group_id: uuid.UUID, body: GroupUpdate, changed_by: str | None = None) -> Group | None:
        group = self.db.get(Group, group_id)
        if not group or not group.is_active:
            return None
        for field, value in body.model_dump(exclude_unset=True).items():
            old = getattr(group, field)
            if old != value and field in TRACKED_FIELDS:
                self.db.add(GroupChangeLog(
                    group_id=group_id,
                    field=field,
                    old_value=str(old) if old is not None else None,
                    new_value=str(value) if value is not None else None,
                    changed_by=changed_by,
                ))
            setattr(group, field, value)
        self.db.commit()
        self.db.refresh(group)
        return group

    def get_changelog(self, group_id: uuid.UUID) -> list[GroupChangeLog] | None:
        if not self.db.get(Group, group_id):
            return None
        return (
            self.db.query(GroupChangeLog)
            .filter(GroupChangeLog.group_id == group_id)
            .order_by(GroupChangeLog.changed_at.desc())
            .all()
        )

    def delete(self, group_id: uuid.UUID) -> bool:
        group = self.db.get(Group, group_id)
        if not group or not group.is_active:
            return False
        group.is_active = False
        self.db.commit()
        return True

    def get_history(
        self, group_id: uuid.UUID, skip: int = 0, limit: int = 60
    ) -> list[dict]:
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
            .filter(
                TrainingSession.group_id == group_id,
                TrainingSession.is_active.is_(True),
            )
            .group_by(
                TrainingSession.id,
                TrainingSession.session_date,
                TrainingSession.session_type,
            )
            .having(func.count(Measurement.id) > 0)
            .order_by(TrainingSession.session_date.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return [
            {
                "session_id": r.session_id,
                "session_date": r.session_date,
                "session_type": r.session_type,
                "avg_sr": float(r.avg_sr) if r.avg_sr is not None else None,
                "avg_dqi": float(r.avg_dqi) if r.avg_dqi is not None else None,
                "avg_ai": float(r.avg_ai) if r.avg_ai is not None else None,
                "avg_trs": float(r.avg_trs) if r.avg_trs is not None else None,
                "avg_vci": float(r.avg_vci) if r.avg_vci is not None else None,
                "player_count": r.player_count or 0,
            }
            for r in rows
        ]

    def get_attendance(self, group_id: uuid.UUID, limit: int = 20) -> dict | None:
        if not self.db.get(Group, group_id):
            return None

        players = (
            self.db.query(Player)
            .join(PlayerGroupAssignment, PlayerGroupAssignment.player_id == Player.id)
            .filter(
                PlayerGroupAssignment.group_id == group_id,
                PlayerGroupAssignment.is_current.is_(True),
            )
            .order_by(Player.last_name.asc(), Player.first_name.asc())
            .all()
        )

        session_ids = [
            row.id for row in (
                self.db.query(TrainingSession.id)
                .filter(
                    TrainingSession.group_id == group_id,
                    TrainingSession.is_active.is_(True),
                )
                .order_by(TrainingSession.session_date.desc())
                .limit(limit)
                .all()
            )
        ]
        if not session_ids:
            return {"sessions": [], "players": players, "records": []}

        sessions = (
            self.db.query(TrainingSession)
            .filter(TrainingSession.id.in_(session_ids))
            .order_by(TrainingSession.session_date.asc())
            .all()
        )

        measurements = (
            self.db.query(Measurement)
            .filter(Measurement.session_id.in_(session_ids))
            .all()
        )
        records = [
            {"player_id": m.player_id, "session_id": m.session_id, "is_absent": m.is_absent}
            for m in measurements
        ]

        return {
            "sessions": sessions,
            "players": players,
            "records": records,
        }

    def get_player_stats(self, group_id: uuid.UUID) -> list[dict] | None:
        if not self.db.get(Group, group_id):
            return None
        rows = (
            self.db.query(
                Measurement.player_id,
                Player.first_name,
                Player.last_name,
                func.count(Measurement.id).label("session_count"),
                func.avg(Measurement.scanning_rate).label("avg_sr"),
                func.avg(Measurement.decision_quality).label("avg_dqi"),
                func.avg(Measurement.anticipation).label("avg_ai"),
                func.avg(Measurement.transition_reset).label("avg_trs"),
                func.avg(Measurement.verbal_comm).label("avg_vci"),
            )
            .join(Player, Player.id == Measurement.player_id)
            .join(TrainingSession, TrainingSession.id == Measurement.session_id)
            .filter(
                TrainingSession.group_id == group_id,
                TrainingSession.is_active.is_(True),
                Measurement.is_absent.is_(False),
            )
            .group_by(Measurement.player_id, Player.first_name, Player.last_name)
            .order_by(Player.last_name.asc(), Player.first_name.asc())
            .all()
        )
        return [
            {
                "player_id": r.player_id,
                "first_name": r.first_name,
                "last_name": r.last_name,
                "session_count": r.session_count,
                "avg_sr": float(r.avg_sr) if r.avg_sr is not None else None,
                "avg_dqi": float(r.avg_dqi) if r.avg_dqi is not None else None,
                "avg_ai": float(r.avg_ai) if r.avg_ai is not None else None,
                "avg_trs": float(r.avg_trs) if r.avg_trs is not None else None,
                "avg_vci": float(r.avg_vci) if r.avg_vci is not None else None,
            }
            for r in rows
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
