from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.limiter import limiter
from app.models.user import User
from app.schemas.auth import LoginRequest, SetupRequest, TokenResponse, UserResponse
from app.services.auth_service import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Pre-calcolato a startup: garantisce che verify_password venga sempre chiamata
# indipendentemente dall'esistenza dell'utente, eliminando il timing attack.
_DUMMY_HASH = hash_password("DummyPassword1!")


@router.post("/setup", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
def setup(request: Request, body: SetupRequest, db: Session = Depends(get_db)):
    if db.query(User).first():
        raise HTTPException(status_code=400, detail="Setup già completato: esiste almeno un utente")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Setup già completato: esiste almeno un utente")
    return {"message": "Admin creato con successo", "user": UserResponse.model_validate(user)}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    candidate_hash = user.hashed_password if user else _DUMMY_HASH
    is_valid = verify_password(body.password, candidate_hash)
    if not user or not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide")
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
