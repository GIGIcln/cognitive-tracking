from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.measurement import Measurement
from app.models.training_session import TrainingSession
from app.rbac import assert_group_access, assert_write_access, require_admin, require_auth
from app.schemas.auth import UserContext
from app.schemas.session import (
    MeasurementResponse,
    MeasurementsBatchInput,
    SessionCreate,
    SessionResponse,
)
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _measurement_to_response(m: Measurement) -> MeasurementResponse:
    return MeasurementResponse(
        id=m.id,
        player_id=m.player_id,
        first_name=m.player.first_name,
        last_name=m.player.last_name,
        scanning_rate=float(m.scanning_rate) if m.scanning_rate is not None else None,
        decision_quality=float(m.decision_quality) if m.decision_quality is not None else None,
        anticipation=float(m.anticipation) if m.anticipation is not None else None,
        transition_reset=float(m.transition_reset) if m.transition_reset is not None else None,
        verbal_comm=float(m.verbal_comm) if m.verbal_comm is not None else None,
        is_absent=m.is_absent,
        notes=m.notes,
    )


def _get_session_or_404(db: Session, session_id: uuid.UUID) -> TrainingSession:
    session = db.get(TrainingSession, session_id)
    if session is None or not session.is_active:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return session


# ── READ: admin + responsabile (tutto) + allenatore (scoped) ──────────────────

@router.get("", response_model=list[SessionResponse])
def list_sessions(
    group_id: uuid.UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    if group_id is not None:
        assert_group_access(current_user, group_id)
        sessions = SessionService(db).list(group_id, skip, limit)
    else:
        sessions = SessionService(db).list(None, skip, limit, allowed_group_ids=scope)
    return [SessionResponse.model_validate(s) for s in sessions]


@router.get("/{session_id}")
def get_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = _get_session_or_404(db, session_id)
    assert_group_access(current_user, session.group_id)

    full = SessionService(db).get(session_id)
    measurements = [_measurement_to_response(m) for m in full.measurements]
    data = SessionResponse.model_validate(full).model_dump()
    data["measurements"] = [m.model_dump() for m in measurements]
    return data


@router.get("/{session_id}/averages")
def get_session_averages(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = _get_session_or_404(db, session_id)
    assert_group_access(current_user, session.group_id)

    result = SessionService(db).get_averages(session_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return result


@router.get("/{session_id}/measurements", response_model=list[MeasurementResponse])
def get_measurements(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = _get_session_or_404(db, session_id)
    assert_group_access(current_user, session.group_id)

    measurements = SessionService(db).get_measurements(session_id)
    if measurements is None:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return [_measurement_to_response(m) for m in measurements]


# ── WRITE: admin (tutto) + allenatore (propri gruppi) ────────────────────────

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    assert_write_access(current_user, body.group_id)
    session = SessionService(db).create(body)
    if session is None:
        raise HTTPException(status_code=404, detail="Stagione corrente o gruppo non trovato")
    return SessionResponse.model_validate(session)


@router.post("/{session_id}/measurements", response_model=list[MeasurementResponse])
def upsert_measurements(
    session_id: uuid.UUID,
    body: MeasurementsBatchInput,
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = _get_session_or_404(db, session_id)
    assert_write_access(current_user, session.group_id)

    try:
        measurements = SessionService(db).upsert_measurements(session, body)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return [_measurement_to_response(m) for m in measurements]


# ── DELETE: solo admin ────────────────────────────────────────────────────────

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    ok = SessionService(db).deactivate(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
