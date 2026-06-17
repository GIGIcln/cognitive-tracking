"""add_player_position

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-17 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column("players", sa.Column("position", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("players", "position")
