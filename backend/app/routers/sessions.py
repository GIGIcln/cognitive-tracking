from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.limiter import limiter
from app.models.measurement import Measurement
from app.models.training_session import TrainingSession
from app.rbac import assert_group_access, assert_write_access, require_admin, require_auth
from app.schemas.auth import UserContext
from app.schemas.attendance import AttendanceBatchInput, AttendanceResponse
from app.schemas.observation_event import ObservationEventResponse, ObservationEventsBatchInput
from app.schemas.pagination import Page
from app.schemas.session import (
    MeasurementResponse,
    MeasurementsBatchInput,
    SessionAveragesResponse,
    SessionCreate,
    SessionRankingsItemResponse,
    SessionResponse,
    SessionUpdate,
)
from app.services.observation_service import (
    ObservationService,
    aggregate_events_to_responses,
    event_to_response,
)
from app.services.attendance_service import AttendanceService
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


async def _get_session_or_404(db: AsyncSession, session_id: uuid.UUID) -> TrainingSession:
    result = await db.execute(select(TrainingSession).where(TrainingSession.id == session_id))
    session = result.scalars().first()
    if session is None or not session.is_active:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return session


@router.get("", response_model=Page[SessionResponse])
async def list_sessions(
    group_id: uuid.UUID | None = None,
    season_id: uuid.UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    scope = current_user.read_scope()
    svc = SessionService(db)
    if group_id is not None:
        assert_group_access(current_user, group_id)
        sessions = await svc.list(group_id, skip, limit, season_id=season_id)
        total = await svc.count(group_id=group_id, season_id=season_id)
    else:
        sessions = await svc.list(None, skip, limit, allowed_group_ids=scope, season_id=season_id)
        total = await svc.count(allowed_group_ids=scope, season_id=season_id)
    return Page(items=[SessionResponse.model_validate(s) for s in sessions], total=total, limit=limit, skip=skip)


@router.get("/{session_id}")
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    full = await SessionService(db).get(session_id)
    if full is None or not full.is_active:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    assert_group_access(current_user, full.group_id)

    measurements = [_measurement_to_response(m) for m in full.measurements]
    data = SessionResponse.model_validate(full).model_dump()
    data["measurements"] = [m.model_dump() for m in measurements]
    return data


@router.get("/{session_id}/averages", response_model=SessionAveragesResponse)
async def get_session_averages(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = await _get_session_or_404(db, session_id)
    assert_group_access(current_user, session.group_id)

    result = await SessionService(db).get_averages(session_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return result


@router.get("/{session_id}/rankings", response_model=list[SessionRankingsItemResponse])
async def get_session_rankings(
    session_id: uuid.UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = await _get_session_or_404(db, session_id)
    assert_group_access(current_user, session.group_id)
    return await SessionService(db).get_rankings(session_id, skip, limit)


@router.get("/{session_id}/measurements", response_model=list[MeasurementResponse])
async def get_measurements(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    full = await SessionService(db).get(session_id)
    if full is None or not full.is_active:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    assert_group_access(current_user, full.group_id)
    return [_measurement_to_response(m) for m in full.measurements]


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    assert_write_access(current_user, body.group_id)
    try:
        session = await SessionService(db).create(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if session is None:
        raise HTTPException(status_code=404, detail="Stagione corrente o gruppo non trovato")
    return SessionResponse.model_validate(session)


@router.post("/{session_id}/measurements", response_model=list[MeasurementResponse])
@limiter.limit("60/minute")
async def upsert_measurements(
    request: Request,
    session_id: uuid.UUID,
    body: MeasurementsBatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = await _get_session_or_404(db, session_id)
    assert_write_access(current_user, session.group_id)

    if not get_settings().allow_manual_scores:
        raise HTTPException(
            status_code=403,
            detail="Inserimento punteggi manuali disabilitato: usare la modalità Conteggio (events).",
        )

    try:
        measurements = await SessionService(db).upsert_measurements(session, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return [_measurement_to_response(m) for m in measurements]


@router.post("/{session_id}/events", response_model=list[ObservationEventResponse])
@limiter.limit("120/minute")
async def upsert_events(
    request: Request,
    session_id: uuid.UUID,
    body: ObservationEventsBatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = await _get_session_or_404(db, session_id)
    assert_write_access(current_user, session.group_id)

    try:
        events = await ObservationService(db).upsert_events(session_id, session.group_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return aggregate_events_to_responses(events)


@router.get("/{session_id}/events", response_model=list[ObservationEventResponse])
async def get_events(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = await _get_session_or_404(db, session_id)
    assert_group_access(current_user, session.group_id)

    events = await ObservationService(db).get_events(session_id)
    return [event_to_response(e) for e in events]


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: uuid.UUID,
    body: SessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_admin),
):
    session = await SessionService(db).update(session_id, body)
    if session is None:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return SessionResponse.model_validate(session)


@router.get("/{session_id}/attendance", response_model=list[AttendanceResponse])
async def get_attendance(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = await _get_session_or_404(db, session_id)
    assert_group_access(current_user, session.group_id)
    rows = await AttendanceService(db).get_by_session(session_id)
    return [AttendanceResponse.model_validate(r) for r in rows]


@router.put("/{session_id}/attendance", response_model=list[AttendanceResponse])
async def upsert_attendance(
    session_id: uuid.UUID,
    body: AttendanceBatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(require_auth),
):
    session = await _get_session_or_404(db, session_id)
    assert_write_access(current_user, session.group_id)
    rows = await AttendanceService(db).upsert_batch(session_id, body.records)
    return [AttendanceResponse.model_validate(r) for r in rows]


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: UserContext = Depends(require_admin),
):
    ok = await SessionService(db).deactivate(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
