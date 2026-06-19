from __future__ import annotations

import uuid

from pydantic import BaseModel, Field, model_validator

_VALID_METRIC_TYPES = {"SR", "DQI", "AI", "TRS", "VCI"}
_VALID_METHODS = {"live", "video", "audio"}


class ObservationEventInput(BaseModel):
    player_id: uuid.UUID
    metric_type: str
    numerator: int = Field(ge=0)
    denominator: int = Field(ge=0)
    method: str = "live"
    observer_notes: str | None = None

    @model_validator(mode="after")
    def _validate_enums(self) -> ObservationEventInput:
        if self.metric_type not in _VALID_METRIC_TYPES:
            raise ValueError(f"metric_type deve essere uno di {sorted(_VALID_METRIC_TYPES)}")
        if self.method not in _VALID_METHODS:
            raise ValueError(f"method deve essere uno di {sorted(_VALID_METHODS)}")
        return self


class ObservationEventsBatchInput(BaseModel):
    events: list[ObservationEventInput]


class ObservationEventResponse(BaseModel):
    id: uuid.UUID
    player_id: uuid.UUID
    first_name: str
    last_name: str
    metric_type: str
    numerator: int
    denominator: int
    raw_rate: float | None
    n_events: int
    reliability_flag: str
    normalized_score: float | None
    method: str
    observer_notes: str | None

    model_config = {"from_attributes": True}
