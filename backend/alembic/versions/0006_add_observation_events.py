"""add_observation_events

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-19 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.create_table(
        "observation_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("player_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("metric_type", sa.String(length=10), nullable=False),
        sa.Column("numerator", sa.Integer(), server_default="0", nullable=False),
        sa.Column("denominator", sa.Integer(), server_default="0", nullable=False),
        sa.Column("method", sa.String(length=10), server_default="live", nullable=False),
        sa.Column("observer_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["training_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "session_id", "player_id", "metric_type",
            name="uq_observation_session_player_metric",
        ),
    )
    op.create_index("ix_observation_events_session_id", "observation_events", ["session_id"])
    op.create_index("ix_observation_events_player_id", "observation_events", ["player_id"])


def downgrade() -> None:
    op.drop_index("ix_observation_events_player_id", table_name="observation_events")
    op.drop_index("ix_observation_events_session_id", table_name="observation_events")
    op.drop_table("observation_events")
