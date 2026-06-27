from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.player import Player
from app.rbac import assert_group_access, assert_write_access, require_auth
from app.schemas.auth import UserContext
from app.schemas.injury_log import InjuryCreate, InjuryOut, InjuryUpdate
from app.services.injury_service import InjuryService

router = APIRouter(prefix="/injury-logs", tags=["injury-logs"])


async def _get_player_or_404(db: AsyncSession, player_id: uuid.UUID) -> Player:
    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalars().first()
    if player is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return player


async def _check_access(
    svc: InjuryService,
    player_id: uuid.UUID,
    current_user: UserContext,
    *,
    write: bool,
) -> None:
    if current_user.is_admin:
        return
    group_id = await svc.get_player_group_id(player_id)
    if group_id is None:
        raise HTTPException(status_code=403, detail="Giocatore non assegnato ad alcun gruppo")
    if write:
        assert_write_access(current_user, group_id)
    else:
        assert_group_access(current_user, group_id)


@router.get("/player/{player_id}", response_model=list[InjuryOut])
async def list_injuries(
    player_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = InjuryService(db)
    await _get_player_or_404(db, player_id)
    await _check_access(svc, player_id, current_user, write=False)
    return await svc.list_for_player(player_id)


@router.post("/player/{player_id}", response_model=InjuryOut, status_code=201)
async def create_injury(
    player_id: uuid.UUID,
    body: InjuryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = InjuryService(db)
    await _get_player_or_404(db, player_id)
    await _check_access(svc, player_id, current_user, write=True)
    return await svc.create(player_id, body)


@router.patch("/{injury_id}", response_model=InjuryOut)
async def update_injury(
    injury_id: uuid.UUID,
    body: InjuryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = InjuryService(db)
    injury = await svc.get(injury_id)
    if injury is None:
        raise HTTPException(status_code=404, detail="Infortunio non trovato")
    await _check_access(svc, injury.player_id, current_user, write=True)
    return await svc.update(injury_id, body)


@router.delete("/{injury_id}", status_code=204)
async def delete_injury(
    injury_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = InjuryService(db)
    injury = await svc.get(injury_id)
    if injury is None:
        raise HTTPException(status_code=404, detail="Infortunio non trovato")
    await _check_access(svc, injury.player_id, current_user, write=True)
    await svc.delete(injury_id)
