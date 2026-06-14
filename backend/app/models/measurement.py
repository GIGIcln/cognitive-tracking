from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import UUID, Boolean, DateTime, ForeignKey, Numeric, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.player import Player
    from app.models.training_session import TrainingSession

_SCORE = Numeric(3, 1)


class Measurement(Base):
    __tablename__ = "measurements"
    __table_args__ = (
        UniqueConstraint("session_id", "player_id", name="uq_measurement_session_player"),
    )

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
    scanning_rate: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    decision_quality: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    anticipation: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    transition_reset: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    verbal_comm: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    is_absent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped[TrainingSession] = relationship("TrainingSession", back_populates="measurements")
    player: Mapped[Player] = relationship("Player", back_populates="measurements")
    group: Mapped[Group] = relationship("Group", back_populates="measurements")
