from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    is_active: bool
    status: str = "active"
    roles: list[str] = []

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserContext(BaseModel):
    """
    Contesto utente estratto dal JWT — non tocca mai il DB dopo il login.
    roles e group_ids sono embedded nel token, verificati ad ogni richiesta
    con un semplice dict lookup in-memory sull'user_store.
    """

    id: str
    email: str
    full_name: str | None
    roles: list[str]
    group_ids: list[str]
    is_active: bool
    status: str = "active"

    @property
    def is_admin(self) -> bool:
        return "admin" in self.roles

    @property
    def is_staff(self) -> bool:
        """True per admin e responsabile_tecnico (lettura globale)."""
        return bool({"admin", "responsabile_tecnico"} & set(self.roles))

    def read_scope(self) -> set[uuid.UUID] | None:
        """
        Scope di lettura per le query.
        None  → nessun filtro (vede tutto).
        set   → filtro ai soli UUID presenti.
        """
        if self.is_staff:
            return None
        return {uuid.UUID(gid) for gid in self.group_ids}
