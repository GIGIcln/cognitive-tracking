from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.assignment import PlayerGroupAssignment
from app.models.player import Player
from app.models.user import User
from app.schemas.player import AssignRequest, PlayerCreate, PlayerResponse, PlayerUpdate
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/players", tags=["players"])


@router.get("", response_model=list[PlayerResponse])
def list_players(
    group_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if group_id is None:
        players = db.query(Player).filter(Player.is_active.is_(True)).all()
    else:
        assignments = (
            db.query(PlayerGroupAssignment)
            .filter(
                PlayerGroupAssignment.group_id == group_id,
                PlayerGroupAssignment.is_current.is_(True),
            )
            .all()
        )
        players = [a.player for a in assignments]
    return [PlayerResponse.model_validate(p) for p in players]


@router.post("", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
def create_player(
    body: PlayerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    player = Player(**body.model_dump())
    db.add(player)
    db.commit()
    db.refresh(player)
    return PlayerResponse.model_validate(player)


@router.put("/{player_id}", response_model=PlayerResponse)
def update_player(
    player_id: uuid.UUID,
    body: PlayerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(player, field, value)
    db.commit()
    db.refresh(player)
    return PlayerResponse.model_validate(player)


@router.post("/{player_id}/assign")
def assign_player(
    player_id: uuid.UUID,
    body: AssignRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")

    current = (
        db.query(PlayerGroupAssignment)
        .filter(
            PlayerGroupAssignment.player_id == player_id,
            PlayerGroupAssignment.is_current.is_(True),
        )
        .first()
    )
    if current:
        current.end_date = date.today()
        current.is_current = False

    new_assignment = PlayerGroupAssignment(
        player_id=player_id,
        group_id=body.group_id,
        start_date=date.today(),
        is_current=True,
    )
    db.add(new_assignment)
    db.commit()
    return {"message": "Giocatore assegnato con successo", "group_id": str(body.group_id)}
