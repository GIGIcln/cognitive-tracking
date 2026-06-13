from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.assignment import PlayerGroupAssignment
    from app.models.season import Season
    from app.models.session import Session
    from app.models.target import GroupTarget


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    season: Mapped[Season] = relationship("Season", back_populates="groups")
    assignments: Mapped[list[PlayerGroupAssignment]] = relationship(
        "PlayerGroupAssignment", back_populates="group"
    )
    sessions: Mapped[list[Session]] = relationship("Session", back_populates="group")
    targets: Mapped[list[GroupTarget]] = relationship("GroupTarget", back_populates="group")
