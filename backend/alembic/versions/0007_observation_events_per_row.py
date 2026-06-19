"""observation_events_per_row

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-19 00:00:00.000000

Convert observation_events from "one aggregated row per metric" to "one row per
event".  The UNIQUE constraint that enforced the single-row-per-(session, player,
metric) invariant is dropped, making the table append-only.  Two new columns are
added: video_ref (provenance) and codebook_version (traceability).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_observation_session_player_metric",
        "observation_events",
        type_="unique",
    )
    op.add_column(
        "observation_events",
        sa.Column("video_ref", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "observation_events",
        sa.Column(
            "codebook_version",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'v1'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("observation_events", "codebook_version")
    op.drop_column("observation_events", "video_ref")
    op.create_unique_constraint(
        "uq_observation_session_player_metric",
        "observation_events",
        ["session_id", "player_id", "metric_type"],
    )
