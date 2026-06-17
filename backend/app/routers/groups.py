from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.assignment import PlayerGroupAssignment
from app.models.group import Group
from app.models.season import Season
from app.rbac import assert_group_access, require_admin, require_auth
from app.schemas.auth import UserContext
from app.schemas.group import (
    GroupCreate,
    GroupDetailResponse,
    GroupResponse,
    PlayerInGroupResponse,
    TargetResponse,
    TargetUpdateItem,
)
from app.services.group_service import GroupService

router = APIRouter(prefix="/groups", tags=["groups"])


def _current_season(db: Session) -> Season:
    season = db.query(Season).filter(Season.is_current.is_(True)).first()
    if not season:
        raise HTTPException(status_code=404, detail="Nessuna stagione corrente trovata")
    return season


# ── READ: admin + responsabile (tutto) + allenatore (scoped) ──────────────────

@router.get("", response_model=list[GroupResponse])
def list_groups(
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    season = _current_season(db)
    q = (
        db.query(Group)
        .filter(Group.season_id == season.id, Group.is_active.is_(True))
        .order_by(Group.birth_year.desc(), Group.sub_group.asc())
    )
    scope = current_user.read_scope()
    if scope is not None:
        q = q.filter(Group.id.in_(scope))
    return [GroupResponse.model_validate(g) for g in q.all()]


@router.get("/{group_id}", response_model=GroupDetailResponse)
def get_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    assert_group_access(current_user, group_id)

    group = (
        db.query(Group)
        .options(joinedload(Group.targets))
        .filter(Group.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")

    assignments = (
        db.query(PlayerGroupAssignment)
        .options(joinedload(PlayerGroupAssignment.player))
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
    current_user: UserContext = Depends(require_auth),
    limit: int = Query(default=60, ge=1, le=200),
):
    assert_group_access(current_user, group_id)
    return GroupService(db).get_history(group_id, limit)


@router.get("/{group_id}/targets", response_model=list[TargetResponse])
def get_targets(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    assert_group_access(current_user, group_id)
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")
    return [TargetResponse.model_validate(t) for t in group.targets]


# ── WRITE: solo admin ─────────────────────────────────────────────────────────

@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    body: GroupCreate,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    season = _current_season(db)
    group = Group(
        season_id=season.id,
        name=body.name,
        category=body.category,
        birth_year=body.birth_year,
        level=body.level,
        sub_group=body.sub_group,
        max_players=body.max_players,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return GroupResponse.model_validate(group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    group = db.get(Group, group_id)
    if not group or not group.is_active:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")
    group.is_active = False
    db.commit()


@router.put("/{group_id}/targets", response_model=list[TargetResponse])
def update_targets(
    group_id: uuid.UUID,
    body: list[TargetUpdateItem],
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    targets = GroupService(db).update_targets(group_id, body)
    if targets is None:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")
    return [TargetResponse.model_validate(t) for t in targets]
