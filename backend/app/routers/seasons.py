from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.rbac import require_admin, require_auth
from app.schemas.auth import UserContext
from app.schemas.season import SeasonCreate, SeasonResponse
from app.services.season_service import SeasonService

router = APIRouter(prefix="/seasons", tags=["seasons"])


@router.get("/current", response_model=SeasonResponse)
def get_current_season(
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_auth),
):
    season = SeasonService(db).get_current()
    if not season:
        raise HTTPException(status_code=404, detail="Nessuna stagione corrente")
    return SeasonResponse.model_validate(season)


@router.get("", response_model=list[SeasonResponse])
def list_seasons(
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    return [SeasonResponse.model_validate(s) for s in SeasonService(db).list_all()]


@router.post("", response_model=SeasonResponse, status_code=status.HTTP_201_CREATED)
def create_season(
    body: SeasonCreate,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    season = SeasonService(db).create(body)
    return SeasonResponse.model_validate(season)


@router.put("/{season_id}/archive", response_model=SeasonResponse)
def archive_season(
    season_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    season = SeasonService(db).archive(season_id)
    if season is None:
        raise HTTPException(status_code=404, detail="Stagione non trovata")
    return SeasonResponse.model_validate(season)
