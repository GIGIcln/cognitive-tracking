from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models.player import Player
from app.rbac import assert_group_access, require_admin, require_auth
from app.schemas.auth import UserContext
from app.schemas.pagination import Page
from app.schemas.player import AssignRequest, BulkAssignRequest, PlayerAssignmentResponse, PlayerCreate, PlayerHistoryItemResponse, PlayerResponse, PlayerUpdate
from app.services.injury_service import InjuryService
from app.services.player_service import PlayerService

router = APIRouter(prefix="/players", tags=["players"])


def _to_response(player: Player, group_name: str | None, availability: str = "disponibile") -> PlayerResponse:
    return PlayerResponse(
        id=player.id,
        first_name=player.first_name,
        last_name=player.last_name,
        birth_year=player.birth_year,
        position=player.position,
        is_active=player.is_active,
        notes=player.notes,
        current_group_name=group_name,
        availability=availability,
    )


@router.get("", response_model=Page[PlayerResponse])
async def list_players(
    group_id: uuid.UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    svc = PlayerService(db)
    inj_svc = InjuryService(db)
    if group_id is not None:
        assert_group_access(current_user, group_id)
        rows = await svc.list(group_id, skip, limit)
        total = await svc.count(group_id=group_id)
    else:
        rows = await svc.list(None, skip, limit, allowed_group_ids=scope)
        total = await svc.count(allowed_group_ids=scope)
    items = [_to_response(p, g, await inj_svc.get_availability(p.id)) for p, g in rows]
    return Page(items=items, total=total, limit=limit, skip=skip)


@router.get("/at-risk", response_model=list[dict[str, Any]])
@limiter.limit("60/minute")
async def get_at_risk_players(
    request: Request,
    min_sessions: int = Query(default=3, ge=2, le=10),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    return await PlayerService(db).get_at_risk_players(min_sessions, allowed_group_ids=scope)


@router.get("/{player_id}", response_model=PlayerResponse)
async def get_player(
    player_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    row = await PlayerService(db).get_with_group(player_id, allowed_group_ids=scope)
    if row is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    player, group_name = row
    availability = await InjuryService(db).get_availability(player_id)
    return _to_response(player, group_name, availability)


@router.get("/{player_id}/assignments", response_model=list[PlayerAssignmentResponse])
async def get_player_assignments(
    player_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    svc = PlayerService(db)
    if scope is not None and await svc.get_with_group(player_id, allowed_group_ids=scope) is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    result = await svc.get_assignments(player_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return result


@router.get("/{player_id}/streak")
async def get_player_streak(
    player_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    svc = PlayerService(db)
    if scope is not None and await svc.get_with_group(player_id, allowed_group_ids=scope) is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return await svc.get_streak(player_id)


@router.get("/{player_id}/history", response_model=list[PlayerHistoryItemResponse])
async def get_player_history(
    player_id: uuid.UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    svc = PlayerService(db)
    if scope is not None and await svc.get_with_group(player_id, allowed_group_ids=scope) is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return await svc.get_history(player_id, skip=skip, limit=limit, allowed_group_ids=scope)


@router.post("", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
async def create_player(
    body: PlayerCreate,
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    player = await PlayerService(db).create(body)
    return PlayerResponse.model_validate(player)


@router.delete("/{player_id}")
async def delete_player(
    player_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    if not await PlayerService(db).deactivate(player_id):
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return {"message": "Giocatore disattivato con successo"}


@router.put("/{player_id}", response_model=PlayerResponse)
async def update_player(
    player_id: uuid.UUID,
    body: PlayerUpdate,
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    player = await PlayerService(db).update(player_id, body)
    if player is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return PlayerResponse.model_validate(player)


@router.post("/{player_id}/assign")
async def assign_player(
    player_id: uuid.UUID,
    body: AssignRequest,
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    try:
        await PlayerService(db).assign_to_group(player_id, body.group_id)
    except ValueError as exc:
        detail = "Gruppo non trovato" if str(exc) == "group" else "Giocatore non trovato"
        raise HTTPException(status_code=404, detail=detail)
    return {"message": "Giocatore assegnato con successo", "group_id": str(body.group_id)}


@router.post("/bulk-assign")
async def bulk_assign_players(
    body: BulkAssignRequest,
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    return await PlayerService(db).bulk_assign_to_group(body.player_ids, body.group_id)
