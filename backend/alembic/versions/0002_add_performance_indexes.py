"""add_performance_indexes

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-15 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.create_index("ix_players_is_active", "players", ["is_active"])
    op.create_index("ix_seasons_is_current", "seasons", ["is_current"])
    op.create_index("ix_assignments_player_id", "player_group_assignments", ["player_id"])
    op.create_index("ix_assignments_group_id", "player_group_assignments", ["group_id"])
    op.create_index("ix_assignments_is_current", "player_group_assignments", ["is_current"])
    op.create_index("ix_measurements_session_id", "measurements", ["session_id"])
    op.create_index("ix_measurements_player_id", "measurements", ["player_id"])
    op.create_index("ix_training_sessions_group_id", "training_sessions", ["group_id"])


def downgrade() -> None:
    op.drop_index("ix_training_sessions_group_id", table_name="training_sessions")
    op.drop_index("ix_measurements_player_id", table_name="measurements")
    op.drop_index("ix_measurements_session_id", table_name="measurements")
    op.drop_index("ix_assignments_is_current", table_name="player_group_assignments")
    op.drop_index("ix_assignments_group_id", table_name="player_group_assignments")
    op.drop_index("ix_assignments_player_id", table_name="player_group_assignments")
    op.drop_index("ix_seasons_is_current", table_name="seasons")
    op.drop_index("ix_players_is_active", table_name="players")
