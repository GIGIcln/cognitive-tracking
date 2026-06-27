from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.rbac import assert_group_access, assert_write_access, require_admin, require_auth
from app.schemas.auth import UserContext
from app.schemas.match import (
    MatchConvocationBatch,
    MatchCreate,
    MatchDetailResponse,
    MatchLineupBatch,
    MatchLineupResponse,
    MatchResponse,
    MatchUpdate,
)
from app.services.match_service import MatchService

router = APIRouter(prefix="/matches", tags=["matches"])


def _lineup_to_response(lu) -> MatchLineupResponse:
    return MatchLineupResponse(
        player_id=lu.player_id,
        player_first_name=lu.player.first_name,
        player_last_name=lu.player.last_name,
        minutes_played=lu.minutes_played,
        position=lu.position,
        notes=lu.notes,
    )


def _to_detail(match) -> MatchDetailResponse:
    resp = MatchDetailResponse.model_validate(match)
    resp.lineups = [_lineup_to_response(lu) for lu in match.lineups]
    return resp


@router.get("", response_model=list[MatchResponse])
async def list_matches(
    group_id: uuid.UUID | None = Query(default=None),
    season_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    if group_id:
        assert_group_access(current_user, group_id)
    matches = await MatchService(db).list(group_id=group_id, season_id=season_id)
    if current_user.read_scope() is not None:
        matches = [m for m in matches if m.group_id in current_user.read_scope()]
    return [MatchResponse.model_validate(m) for m in matches]


@router.post("", response_model=MatchResponse, status_code=status.HTTP_201_CREATED)
async def create_match(
    body: MatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    assert_write_access(current_user, body.group_id)
    match = await MatchService(db).create(body)
    return MatchResponse.model_validate(match)


@router.get("/{match_id}", response_model=MatchDetailResponse)
async def get_match(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    match = await MatchService(db).get(match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    assert_group_access(current_user, match.group_id)
    return _to_detail(match)


@router.patch("/{match_id}", response_model=MatchResponse)
async def update_match(
    match_id: uuid.UUID,
    body: MatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = MatchService(db)
    existing = await svc.get(match_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    assert_write_access(current_user, existing.group_id)
    match = await svc.update(match_id, body)
    return MatchResponse.model_validate(match)


@router.put("/{match_id}/lineup", response_model=MatchDetailResponse)
async def upsert_lineup(
    match_id: uuid.UUID,
    body: MatchLineupBatch,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = MatchService(db)
    existing = await svc.get(match_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    assert_write_access(current_user, existing.group_id)
    match = await svc.upsert_lineup(match_id, body.lineups)
    return _to_detail(match)


@router.get("/{match_id}/convocations", response_model=list[uuid.UUID])
async def get_convocations(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = MatchService(db)
    existing = await svc.get(match_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    assert_group_access(current_user, existing.group_id)
    return await svc.get_convocations(match_id)


@router.put("/{match_id}/convocations", response_model=list[uuid.UUID])
async def upsert_convocations(
    match_id: uuid.UUID,
    body: MatchConvocationBatch,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    svc = MatchService(db)
    existing = await svc.get(match_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    assert_write_access(current_user, existing.group_id)
    return await svc.upsert_convocations(match_id, body.player_ids)


@router.delete("/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_match(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    ok = await MatchService(db).delete(match_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Partita non trovata")
