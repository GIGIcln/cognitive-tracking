"""add nationality, foot, jersey_number, phone to players

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-24 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column("players", sa.Column("nationality", sa.String(), nullable=True))
    op.add_column("players", sa.Column("foot", sa.String(), nullable=True))
    op.add_column("players", sa.Column("jersey_number", sa.Integer(), nullable=True))
    op.add_column("players", sa.Column("phone", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("players", "phone")
    op.drop_column("players", "jersey_number")
    op.drop_column("players", "foot")
    op.drop_column("players", "nationality")
