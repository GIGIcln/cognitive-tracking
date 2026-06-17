from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app import user_store
from app.config import get_settings
from app.schemas.auth import UserContext

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(record: dict) -> str:
    """Genera un JWT con ruoli e group_ids embedded, evitando DB hit futuri."""
    settings = get_settings()
    payload = {
        "sub": record["id"],
        "roles": record.get("roles", []),
        "group_ids": record.get("assigned_group_ids", []),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> UserContext:
    """
    Verifica il JWT e restituisce lo UserContext.
    Legge prima dal cookie HttpOnly, poi dall'header Authorization come fallback.
    Unico I/O: dict lookup in-memory su user_store (O(1), nessuna query DB).
    """
    settings = get_settings()
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token non valido o scaduto",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = request.cookies.get("ct_token")
    if token is None:
        if credentials is None:
            raise exc
        token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise exc
    except JWTError:
        raise exc

    record = user_store.get_by_id(user_id)
    if record is None or not record.get("is_active", True):
        raise exc

    return UserContext(
        id=user_id,
        email=record["email"],
        full_name=record.get("full_name"),
        roles=payload.get("roles", []),
        group_ids=payload.get("group_ids", []),
        is_active=record.get("is_active", True),
    )
