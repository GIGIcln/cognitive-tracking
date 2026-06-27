"""add stats columns to match_lineups

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-27 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column("match_lineups", sa.Column("goals", sa.Integer(), nullable=True))
    op.add_column("match_lineups", sa.Column("assists", sa.Integer(), nullable=True))
    op.add_column("match_lineups", sa.Column("yellow_cards", sa.Integer(), nullable=True))
    op.add_column("match_lineups", sa.Column("red_cards", sa.Integer(), nullable=True))
    op.add_column("match_lineups", sa.Column("rating", sa.Numeric(3, 1), nullable=True))


def downgrade() -> None:
    op.drop_column("match_lineups", "rating")
    op.drop_column("match_lineups", "red_cards")
    op.drop_column("match_lineups", "yellow_cards")
    op.drop_column("match_lineups", "assists")
    op.drop_column("match_lineups", "goals")
