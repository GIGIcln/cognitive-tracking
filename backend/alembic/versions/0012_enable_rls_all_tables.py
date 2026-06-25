"""enable_rls_all_tables

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-24 00:00:00.000000

Enables RLS on all remaining public schema tables so Supabase/PostgREST cannot
expose application data via the auto-generated REST API. No permissive policies
are added — PostgREST (anon/authenticated roles) gets denied entirely.

The FastAPI backend connects as the postgres owner role which has BYPASSRLS, so
all existing application logic continues to work unchanged.
"""

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

_TABLES = [
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
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
