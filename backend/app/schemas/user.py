from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr

VALID_ROLES = frozenset({"admin", "responsabile_tecnico", "allenatore"})


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    roles: list[str] = []
    assigned_group_ids: list[uuid.UUID] = []
    is_active: bool = True


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    password: str | None = None
    full_name: str | None = None
    roles: list[str] | None = None
    assigned_group_ids: list[uuid.UUID] | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    is_active: bool
    roles: list[str]
    assigned_group_ids: list[str]

    model_config = {"from_attributes": True}
