from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.attendance import Attendance
from app.schemas.attendance import AttendanceItem


class AttendanceService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_session(self, session_id: uuid.UUID) -> list[Attendance]:
        return (
            self.db.query(Attendance)
            .filter(Attendance.session_id == session_id)
            .all()
        )

    def upsert_batch(
        self, session_id: uuid.UUID, records: list[AttendanceItem]
    ) -> list[Attendance]:
        """Upsert idempotente: delete-per-session + insert."""
        self.db.query(Attendance).filter(Attendance.session_id == session_id).delete()
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
        self.db.commit()
        return self.get_by_session(session_id)
