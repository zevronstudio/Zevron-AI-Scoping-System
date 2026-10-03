"""Initial guest, project, conversation, requirement, scope and idempotency tables."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    json_type = sa.JSON().with_variant(JSONB, "postgresql")
    op.create_table(
        "guests",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("rate_window", sa.DateTime(), nullable=False),
        sa.Column("rate_count", sa.Integer(), nullable=False),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("guest_id", sa.String(64), sa.ForeignKey("guests.id"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("business_type", sa.String(300), nullable=False),
        sa.Column("project_type", sa.String(300), nullable=False),
        sa.Column("stage", sa.String(40), nullable=False),
        sa.Column("state", json_type, nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("busy_token", sa.String(36)),
        sa.Column("busy_until", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_projects_guest_id", "projects", ["guest_id"])
    tables = {
        "messages": [
            sa.Column("role", sa.String(20), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("questions", json_type, nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        ],
        "requirements": [
            sa.Column("category", sa.String(80), nullable=False),
            sa.Column("key", sa.String(100), nullable=False),
            sa.Column("value", sa.Text(), nullable=False),
            sa.Column("status", sa.String(30), nullable=False),
            sa.Column("source", sa.Text(), nullable=False),
            sa.UniqueConstraint("project_id", "key"),
        ],
        "scopes": [
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("structured_scope", json_type, nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("project_id", "version"),
        ],
        "operations": [
            sa.Column("request_id", sa.String(36), nullable=False),
            sa.Column("fingerprint", sa.String(64), nullable=False),
            sa.UniqueConstraint("project_id", "request_id"),
        ],
    }
    for name, columns in tables.items():
        op.create_table(
            name,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "project_id",
                sa.String(36),
                sa.ForeignKey("projects.id", ondelete="CASCADE"),
                nullable=False,
            ),
            *columns,
        )
        op.create_index(f"ix_{name}_project_id", name, ["project_id"])


def downgrade():
    for table in ["operations", "scopes", "requirements", "messages", "projects", "guests"]:
        op.drop_table(table)
