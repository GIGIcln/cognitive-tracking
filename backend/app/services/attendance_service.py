from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance
from app.models.group import Group
from app.models.training_session import TrainingSession
from app.schemas.attendance import AttendanceItem, PlayerAttendanceItemResponse


class AttendanceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_session(self, session_id: uuid.UUID) -> list[Attendance]:
        result = await self.db.execute(
            select(Attendance).where(Attendance.session_id == session_id)
        )
        return result.scalars().all()

    async def upsert_batch(
        self, session_id: uuid.UUID, records: list[AttendanceItem]
    ) -> list[Attendance]:
        """Upsert idempotente: delete-per-session + insert."""
        await self.db.execute(
            Attendance.__table__.delete().where(Attendance.session_id == session_id)
        )
        rows = [
            Attendance(
                session_id=session_id,
                player_id=r.player_id,
                status=r.status,
                note=r.note,
            )
            for r in records
        ]
        self.db.add_all(rows)
        await self.db.commit()
        return await self.get_by_session(session_id)

    async def get_player_attendance(
        self,
        player_id: uuid.UUID,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> list[PlayerAttendanceItemResponse]:
        q = (
            select(Attendance, TrainingSession, Group)
            .join(TrainingSession, TrainingSession.id == Attendance.session_id)
            .join(Group, Group.id == TrainingSession.group_id)
            .where(
                Attendance.player_id == player_id,
                TrainingSession.is_active.is_(True),
            )
        )
        if allowed_group_ids is not None:
            q = q.where(TrainingSession.group_id.in_(allowed_group_ids))
        q = q.order_by(TrainingSession.session_date.desc())
        result = await self.db.execute(q)
        return [
            PlayerAttendanceItemResponse(
                session_id=a.session_id,
                session_date=ts.session_date,
                session_type=ts.session_type,
                group_name=g.name,
                status=a.status,
                note=a.note,
            )
            for a, ts, g in result.all()
        ]
