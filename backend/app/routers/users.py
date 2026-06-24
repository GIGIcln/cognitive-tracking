from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.rbac import require_admin
from app.schemas.auth import UserContext
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    _: UserContext = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return UserService(db).list()


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    _: UserContext = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return UserService(db).create(body)
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Email già in uso")


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    _: UserContext = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = UserService(db).update(user_id, body)
    if user is None:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: uuid.UUID,
    current_user: UserContext = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if str(user_id) == current_user.id:
        raise HTTPException(status_code=400, detail="Non puoi eliminare il tuo account")
    if not UserService(db).delete(user_id):
        raise HTTPException(status_code=404, detail="Utente non trovato")
