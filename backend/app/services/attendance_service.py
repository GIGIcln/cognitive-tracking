from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance
from app.schemas.attendance import AttendanceItem


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
