from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.player import Player
    from app.models.session import Session

# Precisione: valori da 0.00 a 100.00
_SCORE = Numeric(5, 2)


class Measurement(Base):
    __tablename__ = "measurements"
    __table_args__ = (
        # un solo record per giocatore per sessione
        UniqueConstraint("session_id", "player_id", name="uq_measurement_session_player"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)

    scanning_rate: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    decision_quality: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    anticipation: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    transition_reset: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    verbal_comm: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped[Session] = relationship("Session", back_populates="measurements")
    player: Mapped[Player] = relationship("Player", back_populates="measurements")
