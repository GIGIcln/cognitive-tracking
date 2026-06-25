"""rls_deny_all_policies

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-24 00:00:00.000000

Adds explicit RESTRICTIVE deny-all RLS policies to every public table so
Supabase/PostgREST access is blocked intentionally (not just by default).
This silences the "RLS enabled but no policies exist" advisor warning.

The FastAPI backend connects as postgres (owner, BYPASSRLS) and is unaffected.
"""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

_TABLES = [
    "alembic_version",
    "group_change_logs",
    "group_targets",
    "groups",
    "measurements",
    "observation_events",
    "player_group_assignments",
    "players",
    "seasons",
    "training_sessions",
    "users",
]


def upgrade() -> None:
    for table in _TABLES:
        op.execute(
            f"CREATE POLICY deny_postgrest ON {table} AS RESTRICTIVE USING (false);"
        )


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"DROP POLICY IF EXISTS deny_postgrest ON {table};")
