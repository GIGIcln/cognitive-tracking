from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import UUID, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.player import Player
    from app.models.training_session import TrainingSession

VALID_METRIC_TYPES = frozenset({"SR", "DQI", "AI", "TRS", "VCI"})
VALID_METHODS = frozenset({"live", "video", "audio"})


class ObservationEvent(Base):
    __tablename__ = "observation_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("training_sessions.id"), nullable=False
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id"), nullable=False
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False
    )
    metric_type: Mapped[str] = mapped_column(String(10), nullable=False)
    numerator: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    denominator: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    method: Mapped[str] = mapped_column(String(10), nullable=False, default="live")
    observer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    codebook_version: Mapped[str] = mapped_column(String(16), nullable=False, server_default="v1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    session: Mapped[TrainingSession] = relationship("TrainingSession")
    player: Mapped[Player] = relationship("Player")
    group: Mapped[Group] = relationship("Group")
