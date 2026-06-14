from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.group import Group
from app.models.measurement import Measurement
from app.models.player import Player
from app.models.season import Season
from app.models.training_session import TrainingSession
from app.models.user import User
from app.schemas.session import (
    MeasurementResponse,
    MeasurementsBatchInput,
    SessionCreate,
    SessionResponse,
)
from app.services.auth_service import get_current_user

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


@router.get("", response_model=list[SessionResponse])
def list_sessions(
    group_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(TrainingSession)
    if group_id:
        q = q.filter(TrainingSession.group_id == group_id)
    sessions = q.order_by(TrainingSession.session_date.desc()).all()
    return [SessionResponse.model_validate(s) for s in sessions]


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    season = db.query(Season).filter(Season.is_current.is_(True)).first()
    if not season:
        raise HTTPException(status_code=404, detail="Nessuna stagione corrente trovata")

    group = db.get(Group, body.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppo non trovato")

    session = TrainingSession(
        group_id=body.group_id,
        season_id=season.id,
        session_date=body.session_date,
        session_type=body.session_type,
        duration_min=body.duration_min,
        notes=body.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionResponse.model_validate(session)


@router.get("/{session_id}")
def get_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    measurements = [_measurement_to_response(m) for m in session.measurements]
    data = SessionResponse.model_validate(session).model_dump()
    data["measurements"] = [m.model_dump() for m in measurements]
    return data


@router.get("/{session_id}/averages")
def get_session_averages(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")

    row = (
        db.query(
            func.avg(Measurement.scanning_rate).label("avg_sr"),
            func.avg(Measurement.decision_quality).label("avg_dqi"),
            func.avg(Measurement.anticipation).label("avg_ai"),
            func.avg(Measurement.transition_reset).label("avg_trs"),
            func.avg(Measurement.verbal_comm).label("avg_vci"),
            func.count(Measurement.id).label("player_count"),
        )
        .filter(
            Measurement.session_id == session_id,
            Measurement.is_absent.is_(False),
        )
        .first()
    )

    return {
        "avg_sr": float(row.avg_sr) if row.avg_sr is not None else None,
        "avg_dqi": float(row.avg_dqi) if row.avg_dqi is not None else None,
        "avg_ai": float(row.avg_ai) if row.avg_ai is not None else None,
        "avg_trs": float(row.avg_trs) if row.avg_trs is not None else None,
        "avg_vci": float(row.avg_vci) if row.avg_vci is not None else None,
        "player_count": row.player_count or 0,
    }


@router.post("/{session_id}/measurements", response_model=list[MeasurementResponse])
def upsert_measurements(
    session_id: uuid.UUID,
    body: MeasurementsBatchInput,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")

    for m in body.measurements:
        player = db.get(Player, m.player_id)
        if not player:
            raise HTTPException(status_code=404, detail=f"Giocatore {m.player_id} non trovato")

        stmt = (
            insert(Measurement)
            .values(
                session_id=session_id,
                player_id=m.player_id,
                group_id=session.group_id,
                scanning_rate=m.scanning_rate,
                decision_quality=m.decision_quality,
                anticipation=m.anticipation,
                transition_reset=m.transition_reset,
                verbal_comm=m.verbal_comm,
                is_absent=m.is_absent,
                notes=m.notes,
            )
            .on_conflict_do_update(
                constraint="uq_measurement_session_player",
                set_={
                    "scanning_rate": m.scanning_rate,
                    "decision_quality": m.decision_quality,
                    "anticipation": m.anticipation,
                    "transition_reset": m.transition_reset,
                    "verbal_comm": m.verbal_comm,
                    "is_absent": m.is_absent,
                    "notes": m.notes,
                },
            )
        )
        db.execute(stmt)

    db.commit()
    return get_measurements(session_id, db, _)


@router.get("/{session_id}/measurements", response_model=list[MeasurementResponse])
def get_measurements(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return [_measurement_to_response(m) for m in session.measurements]
