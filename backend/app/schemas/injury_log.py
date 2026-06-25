from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel

VALID_SEVERITIES = frozenset({"lieve", "moderato", "grave"})


class InjuryCreate(BaseModel):
    injury_type: str
    start_date: date
    expected_return: date | None = None
    actual_return: date | None = None
    severity: str = "moderato"
    notes: str | None = None


class InjuryUpdate(BaseModel):
    injury_type: str | None = None
    start_date: date | None = None
    expected_return: date | None = None
    actual_return: date | None = None
    severity: str | None = None
    notes: str | None = None


class InjuryOut(BaseModel):
    id: uuid.UUID
    player_id: uuid.UUID
    injury_type: str
    start_date: date
    expected_return: date | None
    actual_return: date | None
    severity: str
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
