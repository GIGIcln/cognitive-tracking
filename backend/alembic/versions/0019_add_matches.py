"""add matches and match_lineups tables

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-24 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("season_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_date", sa.Date(), nullable=False),
        sa.Column("opponent", sa.String(), nullable=False),
        sa.Column("home_away", sa.String(), nullable=False, server_default="home"),
        sa.Column("match_type", sa.String(), nullable=False, server_default="campionato"),
        sa.Column("score_home", sa.Integer(), nullable=True),
        sa.Column("score_away", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_matches_group_id", "matches", ["group_id"])
    op.create_index("ix_matches_season_id", "matches", ["season_id"])
    op.create_index("ix_matches_match_date", "matches", ["match_date"])

    op.create_table(
        "match_lineups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("player_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("minutes_played", sa.Integer(), nullable=True),
        sa.Column("position", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("match_id", "player_id", name="uq_lineup_match_player"),
    )
    op.create_index("ix_match_lineups_match_id", "match_lineups", ["match_id"])


def downgrade() -> None:
    op.drop_index("ix_match_lineups_match_id", table_name="match_lineups")
    op.drop_table("match_lineups")
    op.drop_index("ix_matches_match_date", table_name="matches")
    op.drop_index("ix_matches_season_id", table_name="matches")
    op.drop_index("ix_matches_group_id", table_name="matches")
    op.drop_table("matches")
