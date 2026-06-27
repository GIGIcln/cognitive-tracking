from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.match import Match, MatchConvocation, MatchLineup
from app.schemas.match import MatchCreate, MatchLineupItem, MatchUpdate, PlayerMatchItemResponse


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

    async def get_convocations(self, match_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.db.execute(
            select(MatchConvocation.player_id).where(MatchConvocation.match_id == match_id)
        )
        return list(result.scalars().all())

    async def upsert_convocations(
        self, match_id: uuid.UUID, player_ids: list[uuid.UUID]
    ) -> list[uuid.UUID]:
        await self.db.execute(
            MatchConvocation.__table__.delete().where(MatchConvocation.match_id == match_id)
        )
        for pid in player_ids:
            self.db.add(MatchConvocation(match_id=match_id, player_id=pid))
        await self.db.commit()
        return player_ids

    async def get_player_matches(
        self, player_id: uuid.UUID
    ) -> list[PlayerMatchItemResponse]:
        result = await self.db.execute(
            select(Match, MatchLineup)
            .join(MatchLineup, MatchLineup.match_id == Match.id)
            .where(MatchLineup.player_id == player_id)
            .order_by(Match.match_date.desc())
        )
        rows = result.all()
        return [
            PlayerMatchItemResponse(
                match_id=match.id,
                match_date=match.match_date,
                opponent=match.opponent,
                home_away=match.home_away,
                match_type=match.match_type,
                score_home=match.score_home,
                score_away=match.score_away,
                minutes_played=lu.minutes_played,
                position=lu.position,
                goals=lu.goals,
                assists=lu.assists,
                yellow_cards=lu.yellow_cards,
                red_cards=lu.red_cards,
                rating=float(lu.rating) if lu.rating is not None else None,
            )
            for match, lu in rows
        ]
