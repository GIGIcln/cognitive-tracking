from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.measurement import Measurement
    from app.models.season import Season


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    group: Mapped[Group] = relationship("Group", back_populates="sessions")
    season: Mapped[Season] = relationship("Season", back_populates="sessions")
    measurements: Mapped[list[Measurement]] = relationship(
        "Measurement", back_populates="session"
    )
