from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.models.assignment import PlayerGroupAssignment
from app.models.injury_log import InjuryLog
from app.schemas.injury_log import InjuryCreate, InjuryUpdate


class InjuryService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_player_group_id(self, player_id: uuid.UUID) -> uuid.UUID | None:
        row = (
            self.db.query(PlayerGroupAssignment.group_id)
            .filter(
                PlayerGroupAssignment.player_id == player_id,
                PlayerGroupAssignment.is_current.is_(True),
            )
            .first()
        )
        return row.group_id if row else None

    def list_for_player(self, player_id: uuid.UUID) -> list[InjuryLog]:
        return (
            self.db.query(InjuryLog)
            .filter(InjuryLog.player_id == player_id)
            .order_by(InjuryLog.start_date.desc())
            .all()
        )

    def get(self, injury_id: uuid.UUID) -> InjuryLog | None:
        return self.db.get(InjuryLog, injury_id)

    def create(self, player_id: uuid.UUID, body: InjuryCreate) -> InjuryLog:
        injury = InjuryLog(
            player_id=player_id,
            injury_type=body.injury_type,
            start_date=body.start_date,
            expected_return=body.expected_return,
            actual_return=body.actual_return,
            severity=body.severity,
            notes=body.notes,
        )
        self.db.add(injury)
        self.db.commit()
        self.db.refresh(injury)
        return injury

    def update(self, injury_id: uuid.UUID, body: InjuryUpdate) -> InjuryLog | None:
        injury = self.db.get(InjuryLog, injury_id)
        if injury is None:
            return None
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(injury, field, value)
        self.db.commit()
        self.db.refresh(injury)
        return injury

    def delete(self, injury_id: uuid.UUID) -> bool:
        injury = self.db.get(InjuryLog, injury_id)
        if injury is None:
            return False
        self.db.delete(injury)
        self.db.commit()
        return True

    def get_active_injury(self, player_id: uuid.UUID) -> InjuryLog | None:
        today = date.today()
        return (
            self.db.query(InjuryLog)
            .filter(
                InjuryLog.player_id == player_id,
                InjuryLog.actual_return.is_(None),
                InjuryLog.start_date <= today,
            )
            .order_by(InjuryLog.start_date.desc())
            .first()
        )

    def get_availability(self, player_id: uuid.UUID) -> str:
        injury = self.get_active_injury(player_id)
        if injury is None:
            return "disponibile"
        if injury.severity == "lieve":
            return "limitato"
        return "infortunato"

    def get_injured_players_for_group(self, group_id: uuid.UUID) -> list[dict]:
        """Restituisce i giocatori con infortuni attivi nel gruppo, per la dashboard."""
        today = date.today()
        rows = (
            self.db.query(InjuryLog)
            .join(
                PlayerGroupAssignment,
                (PlayerGroupAssignment.player_id == InjuryLog.player_id)
                & (PlayerGroupAssignment.group_id == group_id)
                & PlayerGroupAssignment.is_current.is_(True),
            )
            .filter(
                InjuryLog.actual_return.is_(None),
                InjuryLog.start_date <= today,
            )
            .order_by(InjuryLog.start_date.desc())
            .all()
        )
        return rows
