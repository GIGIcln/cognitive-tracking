from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.season import Season
from app.schemas.season import SeasonCreate


class SeasonService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_current(self) -> Season | None:
        result = await self.db.execute(select(Season).where(Season.is_current.is_(True)))
        return result.scalars().first()

    async def list_all(self) -> list[Season]:
        result = await self.db.execute(select(Season).order_by(Season.start_date.desc()))
        return result.scalars().all()

    async def create(self, body: SeasonCreate) -> Season:
        """Archives the current season (if any) and creates a new current one."""
        current = await self.get_current()
        if current:
            current.is_current = False

        new_season = Season(
            name=body.name,
            start_date=body.start_date,
            end_date=body.end_date,
            is_current=True,
        )
        self.db.add(new_season)
        await self.db.commit()
        await self.db.refresh(new_season)
        return new_season

    async def archive(self, season_id: uuid.UUID) -> Season | None:
        """Sets is_current=False. Returns None if season not found."""
        season = await self.db.get(Season, season_id)
        if season is None:
            return None
        season.is_current = False
        await self.db.commit()
        await self.db.refresh(season)
        return season
