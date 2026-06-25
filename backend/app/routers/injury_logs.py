from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.player import Player
from app.rbac import assert_group_access, assert_write_access, require_auth
from app.schemas.auth import UserContext
from app.schemas.injury_log import InjuryCreate, InjuryOut, InjuryUpdate
from app.services.injury_service import InjuryService

router = APIRouter(prefix="/injury-logs", tags=["injury-logs"])


def _get_player_or_404(db: Session, player_id: uuid.UUID) -> Player:
    player = db.get(Player, player_id)
    if player is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return player


def _check_access(
    svc: InjuryService,
    player_id: uuid.UUID,
    current_user: UserContext,
    *,
    write: bool,
) -> None:
    """Admin può sempre accedere. Allenatore/responsabile necessitano del gruppo del giocatore."""
    if current_user.is_admin:
        return
    group_id = svc.get_player_group_id(player_id)
    if group_id is None:
        raise HTTPException(status_code=403, detail="Giocatore non assegnato ad alcun gruppo")
    if write:
        assert_write_access(current_user, group_id)
    else:
        assert_group_access(current_user, group_id)


@router.get("/player/{player_id}", response_model=list[InjuryOut])
def list_injuries(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = InjuryService(db)
    _get_player_or_404(db, player_id)
    _check_access(svc, player_id, current_user, write=False)
    return svc.list_for_player(player_id)


@router.post("/player/{player_id}", response_model=InjuryOut, status_code=201)
def create_injury(
    player_id: uuid.UUID,
    body: InjuryCreate,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = InjuryService(db)
    _get_player_or_404(db, player_id)
    _check_access(svc, player_id, current_user, write=True)
    return svc.create(player_id, body)


@router.patch("/{injury_id}", response_model=InjuryOut)
def update_injury(
    injury_id: uuid.UUID,
    body: InjuryUpdate,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = InjuryService(db)
    injury = svc.get(injury_id)
    if injury is None:
        raise HTTPException(status_code=404, detail="Infortunio non trovato")
    _check_access(svc, injury.player_id, current_user, write=True)
    return svc.update(injury_id, body)


@router.delete("/{injury_id}", status_code=204)
def delete_injury(
    injury_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = InjuryService(db)
    injury = svc.get(injury_id)
    if injury is None:
        raise HTTPException(status_code=404, detail="Infortunio non trovato")
    _check_access(svc, injury.player_id, current_user, write=True)
    svc.delete(injury_id)
