"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-13 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    op.create_table(
        "seasons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "players",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("role", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("season_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "player_group_assignments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("player_id", "group_id", "removed_at", name="uq_player_group_active"),
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("season_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "measurements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("scanning_rate", sa.Numeric(5, 2), nullable=True),
        sa.Column("decision_quality", sa.Numeric(5, 2), nullable=True),
        sa.Column("anticipation", sa.Numeric(5, 2), nullable=True),
        sa.Column("transition_reset", sa.Numeric(5, 2), nullable=True),
        sa.Column("verbal_comm", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "player_id", name="uq_measurement_session_player"),
    )

    op.create_table(
        "group_targets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("season_id", sa.Integer(), nullable=False),
        # scanning_rate
        sa.Column("scanning_rate_insufficient_max", sa.Numeric(5, 2), nullable=True),
        sa.Column("scanning_rate_ottimo_min", sa.Numeric(5, 2), nullable=True),
        # decision_quality
        sa.Column("decision_quality_insufficient_max", sa.Numeric(5, 2), nullable=True),
        sa.Column("decision_quality_ottimo_min", sa.Numeric(5, 2), nullable=True),
        # anticipation
        sa.Column("anticipation_insufficient_max", sa.Numeric(5, 2), nullable=True),
        sa.Column("anticipation_ottimo_min", sa.Numeric(5, 2), nullable=True),
        # transition_reset
        sa.Column("transition_reset_insufficient_max", sa.Numeric(5, 2), nullable=True),
        sa.Column("transition_reset_ottimo_min", sa.Numeric(5, 2), nullable=True),
        # verbal_comm
        sa.Column("verbal_comm_insufficient_max", sa.Numeric(5, 2), nullable=True),
        sa.Column("verbal_comm_ottimo_min", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_id", "season_id", name="uq_target_group_season"),
    )


def downgrade() -> None:
    op.drop_table("group_targets")
    op.drop_table("measurements")
    op.drop_table("sessions")
    op.drop_table("player_group_assignments")
    op.drop_table("groups")
    op.drop_table("players")
    op.drop_table("seasons")
