from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel


class SessionCreate(BaseModel):
    group_id: uuid.UUID
    session_date: date
    session_type: str
    duration_min: int | None = None
    notes: str | None = None


class SessionResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    session_date: date
    session_type: str
    duration_min: int | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MeasurementInput(BaseModel):
    player_id: uuid.UUID
    scanning_rate: float | None = None
    decision_quality: float | None = None
    anticipation: float | None = None
    transition_reset: float | None = None
    verbal_comm: float | None = None
    is_absent: bool = False
    notes: str | None = None


class MeasurementsBatchInput(BaseModel):
    measurements: list[MeasurementInput]


class MeasurementResponse(BaseModel):
    id: uuid.UUID
    player_id: uuid.UUID
    first_name: str
    last_name: str
    scanning_rate: float | None
    decision_quality: float | None
    anticipation: float | None
    transition_reset: float | None
    verbal_comm: float | None
    is_absent: bool
    notes: str | None

    model_config = {"from_attributes": True}
