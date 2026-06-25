from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.rbac import require_auth
from app.services.report_service import render_player_report_pdf, render_team_report_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/player/{player_id}/pdf")
def player_report_pdf(
    player_id: uuid.UUID,
    _: object = Depends(require_auth),
    db: Session = Depends(get_db),
) -> Response:
    pdf = render_player_report_pdf(player_id, db)
    if pdf is None:
        raise HTTPException(status_code=404, detail="Giocatore non trovato o nessun dato disponibile")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="report_player_{player_id}.pdf"'},
    )


@router.get("/team/{group_id}/pdf")
def team_report_pdf(
    group_id: uuid.UUID,
    _: object = Depends(require_auth),
    db: Session = Depends(get_db),
) -> Response:
    pdf = render_team_report_pdf(group_id, db)
    if pdf is None:
        raise HTTPException(status_code=404, detail="Squadra non trovata o nessun dato disponibile")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="report_team_{group_id}.pdf"'},
    )
