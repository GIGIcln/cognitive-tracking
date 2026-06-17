from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import UUID, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.assignment import PlayerGroupAssignment
    from app.models.group_target import GroupTarget
    from app.models.measurement import Measurement
    from app.models.season import Season
    from app.models.training_session import TrainingSession


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    season_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("seasons.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    level: Mapped[str] = mapped_column(String, nullable=False)
    sub_group: Mapped[str | None] = mapped_column(String(1), nullable=True)
    max_players: Mapped[int] = mapped_column(Integer, default=18, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    season: Mapped[Season] = relationship("Season", back_populates="groups")
    assignments: Mapped[list[PlayerGroupAssignment]] = relationship(
        "PlayerGroupAssignment", back_populates="group"
    )
    training_sessions: Mapped[list[TrainingSession]] = relationship(
        "TrainingSession", back_populates="group"
    )
    measurements: Mapped[list[Measurement]] = relationship("Measurement", back_populates="group")
    targets: Mapped[list[GroupTarget]] = relationship("GroupTarget", back_populates="group")
