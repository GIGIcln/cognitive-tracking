"""db_integrity_fixes

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-24 00:00:00.000000

Three targeted fixes:
1. Partial unique index on seasons(is_current) WHERE is_current=TRUE — prevents
   concurrent requests from creating two "current" seasons (PostgreSQL only;
   SQLite doesn't support partial unique indexes but it's test-only).
2. Index on observation_events(group_id) — FK column missing index.
3. Compound index on observation_events(session_id, player_id, metric_type) —
   covers the batch DELETE in observation_service that filters on all three.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "postgresql":
        op.execute(sa.text(
            "CREATE UNIQUE INDEX ix_seasons_one_current"
            " ON seasons (is_current)"
            " WHERE is_current = TRUE"
        ))

    op.create_index("ix_observation_events_group_id", "observation_events", ["group_id"])
    op.create_index(
        "ix_observation_events_session_player_metric",
        "observation_events",
        ["session_id", "player_id", "metric_type"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_observation_events_session_player_metric",
        table_name="observation_events",
    )
    op.drop_index("ix_observation_events_group_id", table_name="observation_events")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("DROP INDEX IF EXISTS ix_seasons_one_current"))
