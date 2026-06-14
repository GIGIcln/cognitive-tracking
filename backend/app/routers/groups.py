from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.assignment import PlayerGroupAssignment
from app.models.group import Group
from app.models.group_target import GroupTarget
from app.models.measurement import Measurement
from app.models.player import Player
from app.models.season import Season
from app.models.training_session import TrainingSession
from app.models.user import User
from app.schemas.group import (
    GroupDetailResponse,
    GroupResponse,
    PlayerInGroupResponse,
    TargetResponse,
    TargetUpdateItem,
)
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/groups", tags=["groups"])


def _current_season(db: Session) -> Season:
    season = db.query(Season).filter(Season.is_current.is_(True)).first()
    if not season:
        raise HTTPException(status_code=404, detail="Nessuna stagione corrente trovata")
    return season


@router.get("", response_model=list[GroupResponse])
def list_groups(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    season = _current_season(db)
    groups = (
        db.query(Group)
        .filter(Group.season_id == season.id)
        .order_by(Group.birth_year.desc(), Group.sub_group.asc())
        .all()
    )
    return [GroupResponse.model_validate(g) for g in groups]


@router.get("/{group_id}", response_model=GroupDetailResponse)
def get_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")

    assignments = (
        db.query(PlayerGroupAssignment)
        .filter(
            PlayerGroupAssignment.group_id == group_id,
            PlayerGroupAssignment.is_current.is_(True),
        )
        .all()
    )
    players = [PlayerInGroupResponse.model_validate(a.player) for a in assignments]
    targets = [TargetResponse.model_validate(t) for t in group.targets]

    return GroupDetailResponse(
        **GroupResponse.model_validate(group).model_dump(),
        players=players,
        targets=targets,
    )


@router.get("/{group_id}/history")
def get_group_history(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = (
        db.query(
            TrainingSession.id.label("session_id"),
            TrainingSession.session_date,
            TrainingSession.session_type,
            func.avg(Measurement.scanning_rate).label("avg_sr"),
            func.avg(Measurement.decision_quality).label("avg_dqi"),
            func.avg(Measurement.anticipation).label("avg_ai"),
            func.avg(Measurement.transition_reset).label("avg_trs"),
            func.avg(Measurement.verbal_comm).label("avg_vci"),
            func.count(Measurement.id).label("player_count"),
        )
        .outerjoin(
            Measurement,
            (Measurement.session_id == TrainingSession.id)
            & Measurement.is_absent.is_(False),
        )
        .filter(TrainingSession.group_id == group_id)
        .group_by(
            TrainingSession.id,
            TrainingSession.session_date,
            TrainingSession.session_type,
        )
        .order_by(TrainingSession.session_date.asc())
        .all()
    )
    return [
        {
            "session_id": str(r.session_id),
            "session_date": str(r.session_date),
            "session_type": r.session_type,
            "avg_sr": float(r.avg_sr) if r.avg_sr is not None else None,
            "avg_dqi": float(r.avg_dqi) if r.avg_dqi is not None else None,
            "avg_ai": float(r.avg_ai) if r.avg_ai is not None else None,
            "avg_trs": float(r.avg_trs) if r.avg_trs is not None else None,
            "avg_vci": float(r.avg_vci) if r.avg_vci is not None else None,
            "player_count": r.player_count or 0,
        }
        for r in rows
    ]


@router.get("/{group_id}/targets", response_model=list[TargetResponse])
def get_targets(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")
    return [TargetResponse.model_validate(t) for t in group.targets]


@router.put("/{group_id}/targets", response_model=list[TargetResponse])
def update_targets(
    group_id: uuid.UUID,
    body: list[TargetUpdateItem],
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")

    existing = {t.parameter: t for t in group.targets}
    for item in body:
        if item.parameter in existing:
            target = existing[item.parameter]
            target.insufficient_max = item.insufficient_max
            target.ottimo_min = item.ottimo_min
        else:
            target = GroupTarget(
                group_id=group_id,
                parameter=item.parameter,
                insufficient_max=item.insufficient_max,
                ottimo_min=item.ottimo_min,
            )
            db.add(target)

    db.commit()
    db.refresh(group)
    return [TargetResponse.model_validate(t) for t in group.targets]
