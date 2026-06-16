from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.player import Player
from app.models.user import User
from app.schemas.player import AssignRequest, PlayerCreate, PlayerResponse, PlayerUpdate
from app.services.auth_service import get_current_user
from app.services.player_service import PlayerService

router = APIRouter(prefix="/players", tags=["players"])


def _to_response(player: Player, group_name: str | None) -> PlayerResponse:
    return PlayerResponse(
        id=player.id,
        first_name=player.first_name,
        last_name=player.last_name,
        birth_year=player.birth_year,
        is_active=player.is_active,
        notes=player.notes,
        current_group_name=group_name,
    )


@router.get("", response_model=list[PlayerResponse])
def list_players(
    group_id: uuid.UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = PlayerService(db).list(group_id, skip, limit)
    return [_to_response(player, group_name) for player, group_name in rows]


@router.post("", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
def create_player(
    body: PlayerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    player = PlayerService(db).create(body)
    return PlayerResponse.model_validate(player)


@router.delete("/{player_id}")
def delete_player(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not PlayerService(db).deactivate(player_id):
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return {"message": "Giocatore disattivato con successo"}


@router.put("/{player_id}", response_model=PlayerResponse)
def update_player(
    player_id: uuid.UUID,
    body: PlayerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    player = PlayerService(db).update(player_id, body)
    if player is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return PlayerResponse.model_validate(player)


@router.get("/{player_id}/history")
def get_player_history(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return PlayerService(db).get_history(player_id)


@router.post("/{player_id}/assign")
def assign_player(
    player_id: uuid.UUID,
    body: AssignRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not PlayerService(db).assign_to_group(player_id, body.group_id):
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return {"message": "Giocatore assegnato con successo", "group_id": str(body.group_id)}
