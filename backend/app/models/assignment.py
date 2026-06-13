from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.player import Player


class PlayerGroupAssignment(Base):
    __tablename__ = "player_group_assignments"
    __table_args__ = (
        # un giocatore può essere attivo in un gruppo una volta sola alla volta
        UniqueConstraint("player_id", "group_id", "removed_at", name="uq_player_group_active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    player: Mapped[Player] = relationship("Player", back_populates="assignments")
    group: Mapped[Group] = relationship("Group", back_populates="assignments")
