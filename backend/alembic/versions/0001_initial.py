"""Create clients, fixed-slot appointments and audit logs.

Revision ID: 0001
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "clients",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(16)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_clients_full_name", "clients", ["full_name"])
    op.create_index("ix_clients_phone", "clients", ["phone"])
    op.create_table(
        "appointments",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "client_id",
            sa.UUID(),
            sa.ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("appointment_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("attendance_confirmation", sa.Boolean(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('Booked', 'Done', 'No-show')", name="valid_status"
        ),
        sa.CheckConstraint(
            "end_time = start_time + interval '30 minutes'", name="fixed_duration"
        ),
        sa.CheckConstraint(
            "EXTRACT(MINUTE FROM start_time) IN (0,30) AND EXTRACT(SECOND FROM start_time) = 0",
            name="slot_grid",
        ),
        sa.CheckConstraint(
            "(attendance_confirmation AND confirmed_at IS NOT NULL) OR (NOT attendance_confirmation AND confirmed_at IS NULL)",
            name="confirmation_consistency",
        ),
    )
    op.create_index("ix_appointments_client_id", "appointments", ["client_id"])
    op.create_index(
        "ix_appointments_appointment_date", "appointments", ["appointment_date"]
    )
    op.create_index(
        "uq_active_slot",
        "appointments",
        ["appointment_date", "start_time"],
        unique=True,
        postgresql_where=sa.text("cancelled_at IS NULL"),
    )
    op.create_table(
        "appointment_audit_logs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "appointment_id",
            sa.UUID(),
            sa.ForeignKey("appointments.id"),
            nullable=False,
        ),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("old_value", postgresql.JSONB()),
        sa.Column("new_value", postgresql.JSONB()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_appointment_audit_logs_appointment_id",
        "appointment_audit_logs",
        ["appointment_id"],
    )


def downgrade():
    op.drop_table("appointment_audit_logs")
    op.drop_table("appointments")
    op.drop_table("clients")
