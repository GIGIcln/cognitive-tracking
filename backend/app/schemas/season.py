from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict


class SeasonCreate(BaseModel):
    name: str
    start_date: date | None = None
    end_date: date | None = None


class SeasonResponse(BaseModel):
    id: uuid.UUID
    name: str
    is_current: bool
    start_date: date | None
    end_date: date | None

    model_config = ConfigDict(from_attributes=True)
