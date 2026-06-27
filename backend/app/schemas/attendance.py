from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, field_validator

VALID_STATUSES = frozenset({"present", "absent", "justified", "injured"})


class AttendanceItem(BaseModel):
    player_id: uuid.UUID
    status: str = "present"
    note: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status deve essere uno tra: {', '.join(VALID_STATUSES)}")
        return v


class AttendanceBatchInput(BaseModel):
    records: list[AttendanceItem]


class AttendanceResponse(BaseModel):
    player_id: uuid.UUID
    status: str
    note: str | None

    model_config = {"from_attributes": True}


class PlayerAttendanceItemResponse(BaseModel):
    session_id: uuid.UUID
    session_date: date
    session_type: str
    group_name: str
    status: str
    note: str | None
