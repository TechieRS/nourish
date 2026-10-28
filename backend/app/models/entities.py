import uuid
from datetime import date, time, datetime
from sqlalchemy import (
    String,
    Date,
    Time,
    DateTime,
    ForeignKey,
    CheckConstraint,
    Index,
    text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Client(Timestamps, Base):
    __tablename__ = "clients"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(100), index=True)
    phone: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)


class Appointment(Timestamps, Base):
    __tablename__ = "appointments"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"), index=True
    )
    appointment_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    status: Mapped[str] = mapped_column(String(12), default="Booked")
    attendance_confirmation: Mapped[bool] = mapped_column(default=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    client: Mapped[Client] = relationship(lazy="joined")
    __table_args__ = (
        CheckConstraint("status IN ('Booked', 'Done', 'No-show')", name="valid_status"),
        CheckConstraint(
            "end_time = start_time + interval '30 minutes'", name="fixed_duration"
        ),
        CheckConstraint(
            "EXTRACT(MINUTE FROM start_time) IN (0,30) AND EXTRACT(SECOND FROM start_time) = 0",
            name="slot_grid",
        ),
        CheckConstraint(
            "(attendance_confirmation AND confirmed_at IS NOT NULL) OR (NOT attendance_confirmation AND confirmed_at IS NULL)",
            name="confirmation_consistency",
        ),
        Index(
            "uq_active_slot",
            "appointment_date",
            "start_time",
            unique=True,
            postgresql_where=text("cancelled_at IS NULL"),
        ),
    )


class AuditLog(Base):
    __tablename__ = "appointment_audit_logs"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("appointments.id"), index=True
    )
    action: Mapped[str] = mapped_column(String(30))
    old_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
