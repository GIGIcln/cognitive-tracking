"""widen_measurement_score_precision

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-19 00:00:00.000000

Widen score columns from Numeric(3,1) to Numeric(4,1).
Numeric(3,1) supports values up to 9.9; the 1–10 scale requires 10.0.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

_SCORE_COLS = (
    "scanning_rate",
    "decision_quality",
    "anticipation",
    "transition_reset",
    "verbal_comm",
)


def upgrade() -> None:
    for col in _SCORE_COLS:
        op.alter_column(
            "measurements",
            col,
            type_=sa.Numeric(4, 1),
            existing_type=sa.Numeric(3, 1),
            existing_nullable=True,
        )


def downgrade() -> None:
    for col in _SCORE_COLS:
        op.alter_column(
            "measurements",
            col,
            type_=sa.Numeric(3, 1),
            existing_type=sa.Numeric(4, 1),
            existing_nullable=True,
        )
