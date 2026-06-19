"""add_group_change_logs

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-19 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.create_table(
        "group_change_logs",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", sa.UUID(as_uuid=True), sa.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("field", sa.String(), nullable=False),
        sa.Column("old_value", sa.String(), nullable=True),
        sa.Column("new_value", sa.String(), nullable=True),
        sa.Column("changed_by", sa.String(), nullable=True),
    )
    op.create_index("ix_group_change_logs_group_id", "group_change_logs", ["group_id"])


def downgrade() -> None:
    op.drop_index("ix_group_change_logs_group_id", table_name="group_change_logs")
    op.drop_table("group_change_logs")
