from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel


class GroupHistoryItemResponse(BaseModel):
    session_id: uuid.UUID
    session_date: date
    session_type: str
    avg_sr: float | None
    avg_dqi: float | None
    avg_ai: float | None
    avg_trs: float | None
    avg_vci: float | None
    player_count: int


class GroupCreate(BaseModel):
    name: str
    category: str
    birth_year: int | None = None
    level: str
    sub_group: str | None = None
    max_players: int = 18


class GroupUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    birth_year: int | None = None
    level: str | None = None
    sub_group: str | None = None
    max_players: int | None = None


class TargetResponse(BaseModel):
    parameter: str
    insufficient_max: float
    ottimo_min: float

    model_config = {"from_attributes": True}


class TargetUpdateItem(BaseModel):
    parameter: str
    insufficient_max: float
    ottimo_min: float


class PlayerInGroupResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    birth_year: int | None

    model_config = {"from_attributes": True}


class GroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    birth_year: int | None
    level: str
    sub_group: str | None
    max_players: int

    model_config = {"from_attributes": True}


class GroupDetailResponse(GroupResponse):
    players: list[PlayerInGroupResponse]
    targets: list[TargetResponse]


class GroupChangeLogResponse(BaseModel):
    id: uuid.UUID
    changed_at: datetime
    field: str
    old_value: str | None
    new_value: str | None
    changed_by: str | None

    model_config = {"from_attributes": True}
