from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.rbac import require_admin, require_auth
from app.schemas.auth import UserContext
from app.schemas.season import SeasonCreate, SeasonResponse
from app.services.season_service import SeasonService

router = APIRouter(prefix="/seasons", tags=["seasons"])


@router.get("/current", response_model=SeasonResponse)
async def get_current_season(
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_auth),
):
    season = await SeasonService(db).get_current()
    if not season:
        raise HTTPException(status_code=404, detail="Nessuna stagione corrente")
    return SeasonResponse.model_validate(season)


@router.get("", response_model=list[SeasonResponse])
async def list_seasons(
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_auth),
):
    return [SeasonResponse.model_validate(s) for s in await SeasonService(db).list_all()]


@router.post("", response_model=SeasonResponse, status_code=status.HTTP_201_CREATED)
async def create_season(
    body: SeasonCreate,
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    season = await SeasonService(db).create(body)
    return SeasonResponse.model_validate(season)


@router.get("/{season_id}/stats")
async def get_season_stats(
    season_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_auth),
):
    from app.models.training_session import TrainingSession
    from app.models.measurement import Measurement

    result = await db.execute(
        select(TrainingSession.id).where(
            TrainingSession.season_id == season_id,
            TrainingSession.is_active.is_(True),
        )
    )
    session_ids = [row[0] for row in result.all()]
    total_sessions = len(session_ids)

    if not session_ids:
        return {
            "total_sessions": 0, "total_players": 0, "total_groups": 0,
            "avg_sr": None, "avg_dqi": None, "avg_ai": None,
            "avg_trs": None, "avg_vci": None,
        }

    agg_result = await db.execute(
        select(
            func.count(distinct(Measurement.player_id)).label("total_players"),
            func.avg(Measurement.scanning_rate).label("avg_sr"),
            func.avg(Measurement.decision_quality).label("avg_dqi"),
            func.avg(Measurement.anticipation).label("avg_ai"),
            func.avg(Measurement.transition_reset).label("avg_trs"),
            func.avg(Measurement.verbal_comm).label("avg_vci"),
        ).where(
            Measurement.session_id.in_(session_ids),
            Measurement.is_absent.is_(False),
        )
    )
    agg = agg_result.first()

    groups_result = await db.execute(
        select(func.count(distinct(TrainingSession.group_id))).where(
            TrainingSession.season_id == season_id,
            TrainingSession.is_active.is_(True),
        )
    )
    total_groups = groups_result.scalar() or 0

    def f(v): return round(float(v), 2) if v is not None else None

    return {
        "total_sessions": total_sessions,
        "total_players": agg.total_players or 0,
        "total_groups": total_groups,
        "avg_sr": f(agg.avg_sr), "avg_dqi": f(agg.avg_dqi),
        "avg_ai": f(agg.avg_ai), "avg_trs": f(agg.avg_trs),
        "avg_vci": f(agg.avg_vci),
    }


@router.put("/{season_id}/archive", response_model=SeasonResponse)
async def archive_season(
    season_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    season = await SeasonService(db).archive(season_id)
    if season is None:
        raise HTTPException(status_code=404, detail="Stagione non trovata")
    return SeasonResponse.model_validate(season)
