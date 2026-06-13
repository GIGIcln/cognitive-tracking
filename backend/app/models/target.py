from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.season import Season

_SCORE = Numeric(5, 2)


class GroupTarget(Base):
    """Soglie di valutazione per gruppo/stagione.

    Per ogni parametro:
      valore ≤ insufficient_max  → insufficiente
      valore ≥ ottimo_min        → ottimo
      in mezzo                   → sufficiente / buono
    """

    __tablename__ = "group_targets"
    __table_args__ = (
        UniqueConstraint("group_id", "season_id", name="uq_target_group_season"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), nullable=False)

    # scanning_rate
    scanning_rate_insufficient_max: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    scanning_rate_ottimo_min: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)

    # decision_quality
    decision_quality_insufficient_max: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    decision_quality_ottimo_min: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)

    # anticipation
    anticipation_insufficient_max: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    anticipation_ottimo_min: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)

    # transition_reset
    transition_reset_insufficient_max: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    transition_reset_ottimo_min: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)

    # verbal_comm
    verbal_comm_insufficient_max: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)
    verbal_comm_ottimo_min: Mapped[Decimal | None] = mapped_column(_SCORE, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    group: Mapped[Group] = relationship("Group", back_populates="targets")
    season: Mapped[Season] = relationship("Season", back_populates="targets")
