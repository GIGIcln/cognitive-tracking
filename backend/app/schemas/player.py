from __future__ import annotations

import uuid

from pydantic import BaseModel


class PlayerCreate(BaseModel):
    first_name: str
    last_name: str
    birth_year: int
    notes: str | None = None


class PlayerUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    birth_year: int | None = None
    is_active: bool | None = None
    notes: str | None = None


class PlayerResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    birth_year: int | None
    is_active: bool
    notes: str | None

    model_config = {"from_attributes": True}


class AssignRequest(BaseModel):
    group_id: uuid.UUID
