"""missing_performance_indexes

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-24 00:00:00.000000

Aggiunge index mancanti su colonne frequentemente filtrate non coperte da 0002/0003:
- training_sessions.is_active  (filtro is_active=True in tutte le list query)
- measurements.is_absent       (filtro is_absent=False in averages/rankings/history)
- observation_events.session_id (FK non indicizzata, usata in DELETE e SELECT)
- observation_events.(session_id, player_id, metric_type) composito
  (copre il pattern DELETE WHERE session_id=? AND (player_id,metric_type) IN ...)
"""

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_training_sessions_is_active", "training_sessions", ["is_active"])
    op.create_index("ix_measurements_is_absent", "measurements", ["is_absent"])
    op.create_index("ix_obs_events_session_id", "observation_events", ["session_id"])
    op.create_index(
        "ix_obs_events_session_player_metric",
        "observation_events",
        ["session_id", "player_id", "metric_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_obs_events_session_player_metric", table_name="observation_events")
    op.drop_index("ix_obs_events_session_id", table_name="observation_events")
    op.drop_index("ix_measurements_is_absent", table_name="measurements")
    op.drop_index("ix_training_sessions_is_active", table_name="training_sessions")
