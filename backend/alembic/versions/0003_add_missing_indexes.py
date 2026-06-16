"""add_missing_indexes

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-16 00:00:00.000000
"""

from __future__ import annotations

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    # FK senza index (Postgres non li crea automaticamente)
    op.create_index("ix_measurements_group_id", "measurements", ["group_id"])
    op.create_index("ix_training_sessions_season_id", "training_sessions", ["season_id"])

    # Usato in ORDER BY su list_sessions e get_group_history
    op.create_index("ix_training_sessions_session_date", "training_sessions", ["session_date"])

    # Compound index per i pattern WHERE player_id=? AND is_current=TRUE
    # e WHERE group_id=? AND is_current=TRUE — più efficienti degli index singoli esistenti
    op.create_index(
        "ix_assignments_player_is_current",
        "player_group_assignments",
        ["player_id", "is_current"],
    )
    op.create_index(
        "ix_assignments_group_is_current",
        "player_group_assignments",
        ["group_id", "is_current"],
    )


def downgrade() -> None:
    op.drop_index("ix_assignments_group_is_current", table_name="player_group_assignments")
    op.drop_index("ix_assignments_player_is_current", table_name="player_group_assignments")
    op.drop_index("ix_training_sessions_session_date", table_name="training_sessions")
    op.drop_index("ix_training_sessions_season_id", table_name="training_sessions")
    op.drop_index("ix_measurements_group_id", table_name="measurements")
