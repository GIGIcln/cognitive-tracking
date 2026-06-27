from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.match import Match, MatchLineup
from app.schemas.match import MatchCreate, MatchLineupItem, MatchUpdate


class MatchService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self,
        group_id: uuid.UUID | None = None,
        season_id: uuid.UUID | None = None,
    ) -> list[Match]:
        q = select(Match)
        if group_id:
            q = q.where(Match.group_id == group_id)
        if season_id:
            q = q.where(Match.season_id == season_id)
        result = await self.db.execute(q.order_by(Match.match_date.desc()))
        return result.scalars().all()

    async def get(self, match_id: uuid.UUID) -> Match | None:
        result = await self.db.execute(
            select(Match)
            .options(
                joinedload(Match.lineups).joinedload(MatchLineup.player)
            )
            .where(Match.id == match_id)
        )
        return result.scalars().first()

    async def create(self, body: MatchCreate) -> Match:
        match = Match(**body.model_dump())
        self.db.add(match)
        await self.db.commit()
        await self.db.refresh(match)
        return match

    async def update(self, match_id: uuid.UUID, body: MatchUpdate) -> Match | None:
        result = await self.db.execute(select(Match).where(Match.id == match_id))
        match = result.scalars().first()
        if not match:
            return None
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(match, field, value)
        await self.db.commit()
        await self.db.refresh(match)
        return match

    async def delete(self, match_id: uuid.UUID) -> bool:
        result = await self.db.execute(select(Match).where(Match.id == match_id))
        match = result.scalars().first()
        if not match:
            return False
        await self.db.delete(match)
        await self.db.commit()
        return True

    async def upsert_lineup(
        self, match_id: uuid.UUID, lineups: list[MatchLineupItem]
    ) -> Match | None:
        result = await self.db.execute(select(Match).where(Match.id == match_id))
        match = result.scalars().first()
        if not match:
            return None
        await self.db.execute(
            MatchLineup.__table__.delete().where(MatchLineup.match_id == match_id)
        )
        for item in lineups:
            self.db.add(MatchLineup(match_id=match_id, **item.model_dump()))
        await self.db.commit()
        return await self.get(match_id)
