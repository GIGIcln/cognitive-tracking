from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from typing import Any
from sqlalchemy.orm import Session

from app.database import get_db
from app.limiter import limiter
from app.models.player import Player
from app.rbac import assert_group_access, require_admin, require_auth
from app.schemas.auth import UserContext
from app.schemas.pagination import Page
from app.schemas.player import AssignRequest, BulkAssignRequest, PlayerAssignmentResponse, PlayerCreate, PlayerHistoryItemResponse, PlayerResponse, PlayerUpdate
from app.services.player_service import PlayerService

router = APIRouter(prefix="/players", tags=["players"])


def _to_response(player: Player, group_name: str | None) -> PlayerResponse:
    return PlayerResponse(
        id=player.id,
        first_name=player.first_name,
        last_name=player.last_name,
        birth_year=player.birth_year,
        position=player.position,
        is_active=player.is_active,
        notes=player.notes,
        current_group_name=group_name,
    )


# ── READ: admin + responsabile (tutto) + allenatore (scoped) ──────────────────

@router.get("", response_model=Page[PlayerResponse])
def list_players(
    group_id: uuid.UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    svc = PlayerService(db)
    if group_id is not None:
        assert_group_access(current_user, group_id)
        rows = svc.list(group_id, skip, limit)
        total = svc.count(group_id=group_id)
    else:
        rows = svc.list(None, skip, limit, allowed_group_ids=scope)
        total = svc.count(allowed_group_ids=scope)
    return Page(items=[_to_response(p, g) for p, g in rows], total=total, limit=limit, skip=skip)


@router.get("/at-risk", response_model=list[dict[str, Any]])
@limiter.limit("60/minute")
def get_at_risk_players(
    request: Request,
    min_sessions: int = Query(default=3, ge=2, le=10),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    return PlayerService(db).get_at_risk_players(min_sessions, allowed_group_ids=scope)


@router.get("/{player_id}", response_model=PlayerResponse)
def get_player(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    row = PlayerService(db).get_with_group(player_id, allowed_group_ids=scope)
    if row is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    player, group_name = row
    return _to_response(player, group_name)


@router.get("/{player_id}/assignments", response_model=list[PlayerAssignmentResponse])
def get_player_assignments(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    if scope is not None and PlayerService(db).get_with_group(player_id, allowed_group_ids=scope) is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    result = PlayerService(db).get_assignments(player_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return result


@router.get("/{player_id}/streak")
def get_player_streak(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    if scope is not None and PlayerService(db).get_with_group(player_id, allowed_group_ids=scope) is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return PlayerService(db).get_streak(player_id)


@router.get("/{player_id}/history", response_model=list[PlayerHistoryItemResponse])
def get_player_history(
    player_id: uuid.UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    svc = PlayerService(db)
    if scope is not None and svc.get_with_group(player_id, allowed_group_ids=scope) is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return svc.get_history(player_id, skip=skip, limit=limit, allowed_group_ids=scope)


# ── WRITE: solo admin ─────────────────────────────────────────────────────────

@router.post("", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
def create_player(
    body: PlayerCreate,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    player = PlayerService(db).create(body)
    return PlayerResponse.model_validate(player)


@router.delete("/{player_id}")
def delete_player(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    if not PlayerService(db).deactivate(player_id):
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return {"message": "Giocatore disattivato con successo"}


@router.put("/{player_id}", response_model=PlayerResponse)
def update_player(
    player_id: uuid.UUID,
    body: PlayerUpdate,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    player = PlayerService(db).update(player_id, body)
    if player is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return PlayerResponse.model_validate(player)


@router.post("/{player_id}/assign")
def assign_player(
    player_id: uuid.UUID,
    body: AssignRequest,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    if not PlayerService(db).assign_to_group(player_id, body.group_id):
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return {"message": "Giocatore assegnato con successo", "group_id": str(body.group_id)}


@router.post("/bulk-assign")
def bulk_assign_players(
    body: BulkAssignRequest,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    return PlayerService(db).bulk_assign_to_group(body.player_ids, body.group_id)
