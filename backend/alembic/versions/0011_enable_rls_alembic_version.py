"""enable_rls_alembic_version

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-24 00:00:00.000000

Enables Row Level Security on alembic_version so Supabase/PostgREST cannot
expose migration state via the auto-generated REST API. No permissive policy
is added, so all PostgREST access is denied. Alembic connects via direct DB
connection (bypasses RLS), so migrations continue to work normally.
"""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE alembic_version ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    op.execute("ALTER TABLE alembic_version DISABLE ROW LEVEL SECURITY;")
