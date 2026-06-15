from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SetupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

    @field_validator("email", mode="after")
    @classmethod
    def email_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("L'email non può essere vuota")
        return v

    @field_validator("full_name", mode="after")
    @classmethod
    def full_name_min_length(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Il nome completo deve avere almeno 2 caratteri")
        return v

    @field_validator("password", mode="after")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La password deve avere almeno 8 caratteri")
        if not any(c.isupper() for c in v):
            raise ValueError("La password deve contenere almeno una lettera maiuscola")
        if not any(c.isdigit() for c in v):
            raise ValueError("La password deve contenere almeno un numero")
        return v


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
