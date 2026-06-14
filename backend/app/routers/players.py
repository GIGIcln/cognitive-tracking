from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.assignment import PlayerGroupAssignment
from app.models.group import Group
from app.models.measurement import Measurement
from app.models.player import Player
from app.models.training_session import TrainingSession
from app.models.user import User
from app.schemas.player import AssignRequest, PlayerCreate, PlayerResponse, PlayerUpdate
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/players", tags=["players"])


def _row_to_response(player: Player, group_name: str | None) -> PlayerResponse:
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
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if group_id is None:
        rows = (
            db.query(Player, Group.name)
            .outerjoin(
                PlayerGroupAssignment,
                (PlayerGroupAssignment.player_id == Player.id)
                & PlayerGroupAssignment.is_current.is_(True),
            )
            .outerjoin(Group, Group.id == PlayerGroupAssignment.group_id)
            .filter(Player.is_active.is_(True))
            .all()
        )
    else:
        rows = (
            db.query(Player, Group.name)
            .join(
                PlayerGroupAssignment,
                (PlayerGroupAssignment.player_id == Player.id)
                & (PlayerGroupAssignment.group_id == group_id)
                & PlayerGroupAssignment.is_current.is_(True),
            )
            .join(Group, Group.id == PlayerGroupAssignment.group_id)
            .all()
        )
    return [_row_to_response(player, group_name) for player, group_name in rows]


@router.post("", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
def create_player(
    body: PlayerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    player = Player(**body.model_dump(exclude={"group_id"}))
    db.add(player)
    db.commit()
    db.refresh(player)

    if body.group_id:
        assignment = PlayerGroupAssignment(
            player_id=player.id,
            group_id=body.group_id,
            start_date=date.today(),
            is_current=True,
        )
        db.add(assignment)
        db.commit()

    return PlayerResponse.model_validate(player)


@router.delete("/{player_id}")
def delete_player(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    player.is_active = False
    db.commit()
    return {"message": "Giocatore disattivato con successo"}


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


@router.get("/{player_id}/history")
def get_player_history(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = (
        db.query(Measurement, TrainingSession, Group)
        .join(TrainingSession, TrainingSession.id == Measurement.session_id)
        .join(Group, Group.id == TrainingSession.group_id)
        .filter(
            Measurement.player_id == player_id,
            Measurement.is_absent.is_(False),
        )
        .order_by(TrainingSession.session_date.asc())
        .all()
    )
    return [
        {
            "session_id": str(m.session_id),
            "session_date": str(ts.session_date),
            "session_type": ts.session_type,
            "group_id": str(ts.group_id),
            "group_name": g.name,
            "scanning_rate": float(m.scanning_rate) if m.scanning_rate is not None else None,
            "decision_quality": float(m.decision_quality) if m.decision_quality is not None else None,
            "anticipation": float(m.anticipation) if m.anticipation is not None else None,
            "transition_reset": float(m.transition_reset) if m.transition_reset is not None else None,
            "verbal_comm": float(m.verbal_comm) if m.verbal_comm is not None else None,
            "is_absent": m.is_absent,
        }
        for m, ts, g in rows
    ]


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
