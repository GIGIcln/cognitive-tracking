from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.assignment import PlayerGroupAssignment
    from app.models.measurement import Measurement


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    assignments: Mapped[list[PlayerGroupAssignment]] = relationship(
        "PlayerGroupAssignment", back_populates="player"
    )
    measurements: Mapped[list[Measurement]] = relationship(
        "Measurement", back_populates="player"
    )
