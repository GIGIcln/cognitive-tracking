from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assignment import PlayerGroupAssignment
from app.models.injury_log import InjuryLog
from app.schemas.injury_log import InjuryCreate, InjuryUpdate


class InjuryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_player_group_id(self, player_id: uuid.UUID) -> uuid.UUID | None:
        result = await self.db.execute(
            select(PlayerGroupAssignment.group_id)
            .where(
                PlayerGroupAssignment.player_id == player_id,
                PlayerGroupAssignment.is_current.is_(True),
            )
        )
        row = result.first()
        return row.group_id if row else None

    async def list_for_player(self, player_id: uuid.UUID) -> list[InjuryLog]:
        result = await self.db.execute(
            select(InjuryLog)
            .where(InjuryLog.player_id == player_id)
            .order_by(InjuryLog.start_date.desc())
        )
        return result.scalars().all()

    async def get(self, injury_id: uuid.UUID) -> InjuryLog | None:
        return await self.db.get(InjuryLog, injury_id)

    async def create(self, player_id: uuid.UUID, body: InjuryCreate) -> InjuryLog:
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
        await self.db.commit()
        await self.db.refresh(injury)
        return injury

    async def update(self, injury_id: uuid.UUID, body: InjuryUpdate) -> InjuryLog | None:
        injury = await self.db.get(InjuryLog, injury_id)
        if injury is None:
            return None
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(injury, field, value)
        await self.db.commit()
        await self.db.refresh(injury)
        return injury

    async def delete(self, injury_id: uuid.UUID) -> bool:
        injury = await self.db.get(InjuryLog, injury_id)
        if injury is None:
            return False
        await self.db.delete(injury)
        await self.db.commit()
        return True

    async def get_active_injury(self, player_id: uuid.UUID) -> InjuryLog | None:
        today = date.today()
        result = await self.db.execute(
            select(InjuryLog)
            .where(
                InjuryLog.player_id == player_id,
                InjuryLog.actual_return.is_(None),
                InjuryLog.start_date <= today,
            )
            .order_by(InjuryLog.start_date.desc())
        )
        return result.scalars().first()

    async def get_availability(self, player_id: uuid.UUID) -> str:
        injury = await self.get_active_injury(player_id)
        if injury is None:
            return "disponibile"
        if injury.severity == "lieve":
            return "limitato"
        return "infortunato"

    async def get_injured_players_for_group(self, group_id: uuid.UUID) -> list[InjuryLog]:
        """Restituisce i giocatori con infortuni attivi nel gruppo, per la dashboard."""
        today = date.today()
        result = await self.db.execute(
            select(InjuryLog)
            .join(
                PlayerGroupAssignment,
                (PlayerGroupAssignment.player_id == InjuryLog.player_id)
                & (PlayerGroupAssignment.group_id == group_id)
                & PlayerGroupAssignment.is_current.is_(True),
            )
            .where(
                InjuryLog.actual_return.is_(None),
                InjuryLog.start_date <= today,
            )
            .order_by(InjuryLog.start_date.desc())
        )
        return result.scalars().all()
