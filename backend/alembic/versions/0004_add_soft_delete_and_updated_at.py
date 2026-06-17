"""add_soft_delete_and_updated_at

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-17 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("groups", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("seasons", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("training_sessions", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("training_sessions", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_groups_is_active", "groups", ["is_active"])
    op.create_index("ix_training_sessions_is_active", "training_sessions", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_training_sessions_is_active", table_name="training_sessions")
    op.drop_index("ix_groups_is_active", table_name="groups")

    op.drop_column("training_sessions", "updated_at")
    op.drop_column("training_sessions", "is_active")

    op.drop_column("seasons", "updated_at")

    op.drop_column("groups", "updated_at")
    op.drop_column("groups", "is_active")
