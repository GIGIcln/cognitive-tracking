from __future__ import annotations

import uuid

from sqlalchemy.orm import Session, joinedload

from app.models.match import Match, MatchLineup
from app.schemas.match import MatchCreate, MatchLineupItem, MatchUpdate


class MatchService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(
        self,
        group_id: uuid.UUID | None = None,
        season_id: uuid.UUID | None = None,
    ) -> list[Match]:
        q = self.db.query(Match)
        if group_id:
            q = q.filter(Match.group_id == group_id)
        if season_id:
            q = q.filter(Match.season_id == season_id)
        return q.order_by(Match.match_date.desc()).all()

    def get(self, match_id: uuid.UUID) -> Match | None:
        return (
            self.db.query(Match)
            .options(
                joinedload(Match.lineups).joinedload(MatchLineup.player)
            )
            .filter(Match.id == match_id)
            .first()
        )

    def create(self, body: MatchCreate) -> Match:
        match = Match(**body.model_dump())
        self.db.add(match)
        self.db.commit()
        self.db.refresh(match)
        return match

    def update(self, match_id: uuid.UUID, body: MatchUpdate) -> Match | None:
        match = self.db.query(Match).filter(Match.id == match_id).first()
        if not match:
            return None
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(match, field, value)
        self.db.commit()
        self.db.refresh(match)
        return match

    def delete(self, match_id: uuid.UUID) -> bool:
        match = self.db.query(Match).filter(Match.id == match_id).first()
        if not match:
            return False
        self.db.delete(match)
        self.db.commit()
        return True

    def upsert_lineup(
        self, match_id: uuid.UUID, lineups: list[MatchLineupItem]
    ) -> Match | None:
        match = self.db.query(Match).filter(Match.id == match_id).first()
        if not match:
            return None
        self.db.query(MatchLineup).filter(MatchLineup.match_id == match_id).delete()
        for item in lineups:
            self.db.add(MatchLineup(match_id=match_id, **item.model_dump()))
        self.db.commit()
        return self.get(match_id)
