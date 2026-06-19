from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.rbac import assert_group_access, require_admin, require_auth
from app.schemas.auth import UserContext
from app.schemas.group import (
    AttendancePlayerInfo,
    AttendanceRecord,
    AttendanceSessionInfo,
    GroupAttendanceResponse,
    GroupChangeLogResponse,
    GroupCreate,
    GroupDetailResponse,
    GroupHistoryItemResponse,
    GroupResponse,
    GroupUpdate,
    PlayerInGroupResponse,
    TargetResponse,
    TargetUpdateItem,
)
from app.services.group_service import GroupService

router = APIRouter(prefix="/groups", tags=["groups"])


# ── READ: admin + responsabile (tutto) + allenatore (scoped) ──────────────────

@router.get("", response_model=list[GroupResponse])
def list_groups(
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    groups = GroupService(db).list(current_user.read_scope())
    return [GroupResponse.model_validate(g) for g in groups]


@router.get("/{group_id}", response_model=GroupDetailResponse)
def get_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    assert_group_access(current_user, group_id)

    group, assignments = GroupService(db).get(group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")

    players = [PlayerInGroupResponse.model_validate(a.player) for a in assignments]
    targets = [TargetResponse.model_validate(t) for t in group.targets]
    return GroupDetailResponse(
        **GroupResponse.model_validate(group).model_dump(),
        players=players,
        targets=targets,
    )


@router.get("/{group_id}/history", response_model=list[GroupHistoryItemResponse])
def get_group_history(
    group_id: uuid.UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=60, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    assert_group_access(current_user, group_id)
    return GroupService(db).get_history(group_id, skip, limit)


@router.get("/{group_id}/attendance", response_model=GroupAttendanceResponse)
def get_attendance(
    group_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=60),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    assert_group_access(current_user, group_id)
    data = GroupService(db).get_attendance(group_id, limit)
    if data is None:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")
    return GroupAttendanceResponse(
        sessions=[AttendanceSessionInfo.model_validate(s) for s in data["sessions"]],
        players=[AttendancePlayerInfo(id=p.id, first_name=p.first_name, last_name=p.last_name) for p in data["players"]],
        records=[AttendanceRecord(**r) for r in data["records"]],
    )


@router.get("/{group_id}/targets", response_model=list[TargetResponse])
def get_targets(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    assert_group_access(current_user, group_id)
    targets = GroupService(db).get_targets(group_id)
    if targets is None:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")
    return [TargetResponse.model_validate(t) for t in targets]


# ── WRITE: solo admin ─────────────────────────────────────────────────────────

@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    body: GroupCreate,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    group = GroupService(db).create(body)
    if group is None:
        raise HTTPException(status_code=404, detail="Nessuna stagione corrente trovata")
    return GroupResponse.model_validate(group)


@router.get("/{group_id}/changelog", response_model=list[GroupChangeLogResponse])
def get_changelog(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    assert_group_access(current_user, group_id)
    logs = GroupService(db).get_changelog(group_id)
    if logs is None:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")
    return [GroupChangeLogResponse.model_validate(e) for e in logs]


@router.patch("/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: uuid.UUID,
    body: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_admin),
):
    actor = current_user.full_name or current_user.email
    group = GroupService(db).update(group_id, body, changed_by=actor)
    if group is None:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")
    return GroupResponse.model_validate(group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    ok = GroupService(db).delete(group_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")


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
