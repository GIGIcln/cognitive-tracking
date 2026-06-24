"""missing_performance_indexes

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-24 00:00:00.000000

Aggiunge index su measurements.is_absent (filtro is_absent=False in averages/
rankings/history). Gli altri index previsti (training_sessions.is_active,
observation_events.session_id e il composito su session+player+metric) erano
già presenti nel DB con i nomi creati da migrazioni precedenti.
"""

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_measurements_is_absent", "measurements", ["is_absent"])


def downgrade() -> None:
    op.drop_index("ix_measurements_is_absent", table_name="measurements")
