from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

logger = logging.getLogger(__name__)

from app import user_store
from app.config import get_settings
from app.limiter import limiter
from app.schemas.auth import LoginRequest, TokenResponse, UserContext, UserResponse
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Pre-calcolato a startup: garantisce che verify_password venga sempre chiamata
# indipendentemente dall'esistenza dell'utente, eliminando il timing attack.
_DUMMY_HASH = hash_password("DummyPassword1!")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, response: Response, body: LoginRequest):
    record = user_store.get_by_email(body.email)
    candidate_hash = record["hashed_password"] if record else _DUMMY_HASH
    is_valid = verify_password(body.password, candidate_hash)
    rid = getattr(request.state, "request_id", "-")
    if not record or not is_valid or not record.get("is_active", True):
        logger.warning("[%s] Login fallito: email='%s'", rid, body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenziali non valide",
        )
    logger.info("[%s] Login riuscito: email='%s'", rid, body.email)
    settings = get_settings()
    token = create_access_token(record)
    is_production = settings.app_env == "production"
    response.set_cookie(
        key="ct_token",
        value=token,
        httponly=True,
        samesite="none" if is_production else "lax",
        secure=is_production,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=record["id"],
            email=record["email"],
            full_name=record.get("full_name"),
            is_active=record.get("is_active", True),
            roles=record.get("roles", []),
        ),
    )


@router.post("/logout")
def logout(response: Response):
    settings = get_settings()
    is_production = settings.app_env == "production"
    response.delete_cookie(
        key="ct_token",
        path="/",
        samesite="none" if is_production else "lax",
        secure=is_production,
    )
    return {"message": "Logout effettuato"}


@router.get("/me", response_model=UserResponse)
def me(current_user: UserContext = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        roles=current_user.roles,
    )
