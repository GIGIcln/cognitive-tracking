from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.limiter import limiter
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserContext, UserResponse
from app.schemas.user import UserCreate
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.services.user_service import UserService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Pre-calcolato a startup: garantisce che verify_password venga sempre chiamata
# indipendentemente dall'esistenza dell'utente, eliminando il timing attack.
_DUMMY_HASH = hash_password("DummyPassword1!")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    user = await svc.get_by_email(body.email)
    candidate_hash = user.hashed_password if user else _DUMMY_HASH
    is_valid = verify_password(body.password, candidate_hash)
    rid = getattr(request.state, "request_id", "-")
    if not user or not is_valid or not user.is_active:
        logger.warning("[%s] Login fallito: email='%s'", rid, body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenziali non valide",
        )
    logger.info("[%s] Login riuscito: email='%s'", rid, body.email)
    settings = get_settings()
    token = create_access_token(user)
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
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            status=getattr(user, "status", "active"),
            roles=user.roles or [],
        ),
    )


@router.post("/logout")
async def logout(response: Response):
    settings = get_settings()
    is_production = settings.app_env == "production"
    response.delete_cookie(
        key="ct_token",
        path="/",
        samesite="none" if is_production else "lax",
        secure=is_production,
    )
    return {"message": "Logout effettuato"}


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Registrazione pubblica per allenatori. Account creato in stato pending."""
    svc = UserService(db)
    if await svc.get_by_email(body.email):
        raise HTTPException(status_code=409, detail="Email già in uso")
    user = await svc.create(UserCreate(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        roles=["allenatore"],
        is_active=False,
        status="pending",
    ))
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        status=user.status,
        roles=user.roles or [],
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: UserContext = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        status=current_user.status,
        roles=current_user.roles,
    )
