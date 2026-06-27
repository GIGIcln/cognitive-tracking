from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

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
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _current_season(self) -> Season | None:
        result = await self.db.execute(select(Season).where(Season.is_current.is_(True)))
        return result.scalars().first()

    async def list(self, scope: list[uuid.UUID] | None, season_id: uuid.UUID | None = None) -> list[Group]:
        if season_id is None:
            season = await self._current_season()
            if not season:
                return []
            season_id = season.id
        q = (
            select(Group)
            .where(Group.season_id == season_id, Group.is_active.is_(True))
            .order_by(Group.birth_year.desc(), Group.sub_group.asc())
        )
        if scope is not None:
            q = q.where(Group.id.in_(scope))
        result = await self.db.execute(q)
        return result.scalars().all()

    async def get(self, group_id: uuid.UUID) -> tuple[Group, list[PlayerGroupAssignment]] | tuple[None, None]:
        result = await self.db.execute(
            select(Group)
            .options(joinedload(Group.targets))
            .where(Group.id == group_id)
        )
        group = result.scalars().first()
        if not group:
            return None, None
        result2 = await self.db.execute(
            select(PlayerGroupAssignment)
            .options(joinedload(PlayerGroupAssignment.player))
            .where(
                PlayerGroupAssignment.group_id == group_id,
                PlayerGroupAssignment.is_current.is_(True),
            )
        )
        assignments = result2.scalars().all()
        return group, assignments

    async def get_targets(self, group_id: uuid.UUID) -> list[GroupTarget] | None:
        group = await self.db.get(Group, group_id)
        if not group:
            return None
        result = await self.db.execute(
            select(GroupTarget).where(GroupTarget.group_id == group_id)
        )
        return result.scalars().all()

    async def create(self, body: GroupCreate) -> Group | None:
        season = await self._current_season()
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
        await self.db.commit()
        await self.db.refresh(group)
        return group

    async def update(self, group_id: uuid.UUID, body: GroupUpdate, changed_by: str | None = None) -> Group | None:
        group = await self.db.get(Group, group_id)
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
        await self.db.commit()
        await self.db.refresh(group)
        return group

    async def get_changelog(self, group_id: uuid.UUID) -> list[GroupChangeLog] | None:
        if not await self.db.get(Group, group_id):
            return None
        result = await self.db.execute(
            select(GroupChangeLog)
            .where(GroupChangeLog.group_id == group_id)
            .order_by(GroupChangeLog.changed_at.desc())
        )
        return result.scalars().all()

    async def delete(self, group_id: uuid.UUID) -> bool:
        group = await self.db.get(Group, group_id)
        if not group or not group.is_active:
            return False
        group.is_active = False
        await self.db.commit()
        return True

    async def get_history(
        self, group_id: uuid.UUID, skip: int = 0, limit: int = 60
    ) -> list[dict]:
        stmt = (
            select(
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
            .where(
                TrainingSession.group_id == group_id,
                TrainingSession.is_active.is_(True),
            )
            .group_by(
                TrainingSession.id,
                TrainingSession.session_date,
                TrainingSession.session_type,
            )
            .order_by(TrainingSession.session_date.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        rows = result.all()
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

    async def get_attendance(self, group_id: uuid.UUID, limit: int = 20) -> dict | None:
        if not await self.db.get(Group, group_id):
            return None

        result = await self.db.execute(
            select(Player)
            .join(PlayerGroupAssignment, PlayerGroupAssignment.player_id == Player.id)
            .where(
                PlayerGroupAssignment.group_id == group_id,
                PlayerGroupAssignment.is_current.is_(True),
            )
            .order_by(Player.last_name.asc(), Player.first_name.asc())
        )
        players = result.scalars().all()

        sid_result = await self.db.execute(
            select(TrainingSession.id)
            .where(
                TrainingSession.group_id == group_id,
                TrainingSession.is_active.is_(True),
            )
            .order_by(TrainingSession.session_date.desc())
            .limit(limit)
        )
        session_ids = [row.id for row in sid_result.all()]
        if not session_ids:
            return {"sessions": [], "players": players, "records": []}

        sess_result = await self.db.execute(
            select(TrainingSession)
            .where(TrainingSession.id.in_(session_ids))
            .order_by(TrainingSession.session_date.asc())
        )
        sessions = sess_result.scalars().all()

        meas_result = await self.db.execute(
            select(Measurement)
            .where(Measurement.session_id.in_(session_ids))
        )
        measurements = meas_result.scalars().all()
        records = [
            {"player_id": m.player_id, "session_id": m.session_id, "is_absent": m.is_absent}
            for m in measurements
        ]

        return {
            "sessions": sessions,
            "players": players,
            "records": records,
        }

    async def get_player_stats(self, group_id: uuid.UUID) -> list[dict] | None:
        if not await self.db.get(Group, group_id):
            return None
        stmt = (
            select(
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
            .where(
                TrainingSession.group_id == group_id,
                TrainingSession.is_active.is_(True),
                Measurement.is_absent.is_(False),
            )
            .group_by(Measurement.player_id, Player.first_name, Player.last_name)
            .order_by(Player.last_name.asc(), Player.first_name.asc())
        )
        result = await self.db.execute(stmt)
        rows = result.all()
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

    async def update_targets(
        self, group_id: uuid.UUID, body: list[TargetUpdateItem]
    ) -> list[GroupTarget] | None:
        """Returns None if group not found."""
        group = await self.db.get(Group, group_id)
        if not group:
            return None

        existing_result = await self.db.execute(
            select(GroupTarget).where(GroupTarget.group_id == group_id)
        )
        existing = {t.parameter: t for t in existing_result.scalars().all()}
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

        await self.db.commit()
        # Return fresh targets
        targets_result = await self.db.execute(
            select(GroupTarget).where(GroupTarget.group_id == group_id)
        )
        return targets_result.scalars().all()
