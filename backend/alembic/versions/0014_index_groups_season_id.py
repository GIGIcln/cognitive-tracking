"""index_groups_season_id

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-24 00:00:00.000000

Adds a covering index on groups.season_id to satisfy the FK constraint
groups_season_id_fkey and avoid sequential scans on FK lookups.
"""

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_groups_season_id", "groups", ["season_id"])


def downgrade() -> None:
    op.drop_index("ix_groups_season_id", table_name="groups")
