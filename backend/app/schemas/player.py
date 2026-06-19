from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel


class PlayerHistoryItemResponse(BaseModel):
    session_id: uuid.UUID
    session_date: date
    session_type: str
    group_id: uuid.UUID
    group_name: str
    scanning_rate: float | None
    decision_quality: float | None
    anticipation: float | None
    transition_reset: float | None
    verbal_comm: float | None


class PlayerCreate(BaseModel):
    first_name: str
    last_name: str
    birth_year: int
    position: str | None = None
    notes: str | None = None
    group_id: uuid.UUID | None = None


class PlayerUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    birth_year: int | None = None
    position: str | None = None
    is_active: bool | None = None
    notes: str | None = None


class PlayerResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    birth_year: int | None
    position: str | None = None
    is_active: bool
    notes: str | None
    current_group_name: str | None = None

    model_config = {"from_attributes": True}


class AssignRequest(BaseModel):
    group_id: uuid.UUID


class BulkAssignRequest(BaseModel):
    player_ids: list[uuid.UUID]
    group_id: uuid.UUID
