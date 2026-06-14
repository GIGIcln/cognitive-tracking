from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import UUID, DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.group import Group

_SCORE = Numeric(3, 1)


class GroupTarget(Base):
    __tablename__ = "group_targets"
    __table_args__ = (
        UniqueConstraint("group_id", "parameter", name="uq_target_group_parameter"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False
    )
    parameter: Mapped[str] = mapped_column(String, nullable=False)
    insufficient_max: Mapped[Decimal] = mapped_column(_SCORE, nullable=False)
    ottimo_min: Mapped[Decimal] = mapped_column(_SCORE, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    group: Mapped[Group] = relationship("Group", back_populates="targets")
