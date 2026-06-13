from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.session import Session
    from app.models.target import GroupTarget


class Season(Base):
    __tablename__ = "seasons"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    groups: Mapped[list[Group]] = relationship("Group", back_populates="season")
    sessions: Mapped[list[Session]] = relationship("Session", back_populates="season")
    targets: Mapped[list[GroupTarget]] = relationship("GroupTarget", back_populates="season")
