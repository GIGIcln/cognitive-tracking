from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.season import Season
from app.schemas.season import SeasonCreate


class SeasonService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_current(self) -> Season | None:
        return self.db.query(Season).filter(Season.is_current.is_(True)).first()

    def list_all(self) -> list[Season]:
        return self.db.query(Season).order_by(Season.start_date.desc()).all()

    def create(self, body: SeasonCreate) -> Season:
        """Archives the current season (if any) and creates a new current one."""
        current = self.get_current()
        if current:
            current.is_current = False

        new_season = Season(
            name=body.name,
            start_date=body.start_date,
            end_date=body.end_date,
            is_current=True,
        )
        self.db.add(new_season)
        self.db.commit()
        self.db.refresh(new_season)
        return new_season

    def archive(self, season_id: uuid.UUID) -> Season | None:
        """Sets is_current=False. Returns None if season not found."""
        season = self.db.get(Season, season_id)
        if season is None:
            return None
        season.is_current = False
        self.db.commit()
        self.db.refresh(season)
        return season
