from __future__ import annotations

import uuid
from datetime import date, datetime
from pydantic import BaseModel, field_validator

VALID_HOME_AWAY = frozenset({"home", "away", "neutral"})
VALID_MATCH_TYPES = frozenset({"campionato", "coppa", "amichevole"})


class MatchLineupItem(BaseModel):
    player_id: uuid.UUID
    minutes_played: int | None = None
    position: str | None = None
    goals: int | None = None
    assists: int | None = None
    yellow_cards: int | None = None
    red_cards: int | None = None
    rating: float | None = None
    notes: str | None = None


class MatchLineupBatch(BaseModel):
    lineups: list[MatchLineupItem]


class MatchLineupResponse(BaseModel):
    player_id: uuid.UUID
    player_first_name: str
    player_last_name: str
    minutes_played: int | None
    position: str | None
    goals: int | None
    assists: int | None
    yellow_cards: int | None
    red_cards: int | None
    rating: float | None
    notes: str | None

    model_config = {"from_attributes": True}


class PlayerMatchItemResponse(BaseModel):
    match_id: uuid.UUID
    match_date: date
    opponent: str
    home_away: str
    match_type: str
    score_home: int | None
    score_away: int | None
    minutes_played: int | None
    position: str | None
    goals: int | None
    assists: int | None
    yellow_cards: int | None
    red_cards: int | None
    rating: float | None

    model_config = {"from_attributes": True}


class MatchCreate(BaseModel):
    group_id: uuid.UUID
    season_id: uuid.UUID
    match_date: date
    opponent: str
    home_away: str = "home"
    match_type: str = "campionato"
    score_home: int | None = None
    score_away: int | None = None
    notes: str | None = None

    @field_validator("home_away")
    @classmethod
    def validate_home_away(cls, v: str) -> str:
        if v not in VALID_HOME_AWAY:
            raise ValueError(f"home_away deve essere: {', '.join(VALID_HOME_AWAY)}")
        return v

    @field_validator("match_type")
    @classmethod
    def validate_match_type(cls, v: str) -> str:
        if v not in VALID_MATCH_TYPES:
            raise ValueError(f"match_type deve essere: {', '.join(VALID_MATCH_TYPES)}")
        return v


class MatchUpdate(BaseModel):
    match_date: date | None = None
    opponent: str | None = None
    home_away: str | None = None
    match_type: str | None = None
    score_home: int | None = None
    score_away: int | None = None
    notes: str | None = None

    @field_validator("home_away")
    @classmethod
    def validate_home_away(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_HOME_AWAY:
            raise ValueError(f"home_away deve essere: {', '.join(VALID_HOME_AWAY)}")
        return v

    @field_validator("match_type")
    @classmethod
    def validate_match_type(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_MATCH_TYPES:
            raise ValueError(f"match_type deve essere: {', '.join(VALID_MATCH_TYPES)}")
        return v


class MatchConvocationBatch(BaseModel):
    player_ids: list[uuid.UUID]


class MatchResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    season_id: uuid.UUID
    match_date: date
    opponent: str
    home_away: str
    match_type: str
    score_home: int | None
    score_away: int | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchDetailResponse(MatchResponse):
    lineups: list[MatchLineupResponse] = []
