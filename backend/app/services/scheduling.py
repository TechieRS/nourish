from datetime import datetime, time, timedelta, date
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.models.entities import Appointment, AuditLog

SLOTS = [time(h, m) for h in (9, 10, 11, 14, 15, 16) for m in (0, 30)]
HORIZON = 90


def now():
    return datetime.now(get_settings().timezone)


def validate_slot(day: date, start: time):
    current = now()
    if day < current.date() or day > current.date() + timedelta(days=HORIZON):
        raise HTTPException(422, "Choose a date within the next 90 days.")
    if day.weekday() == 6 or start not in SLOTS:
        raise HTTPException(
            422,
            "Choose an available consultation time. The practice is closed on Sundays.",
        )
    if datetime.combine(day, start, tzinfo=current.tzinfo) <= current:
        raise HTTPException(422, "This time has passed. Please choose a later slot.")


def availability(db: Session, day: date):
    current = now()
    if (
        day < current.date()
        or day > current.date() + timedelta(days=HORIZON)
        or day.weekday() == 6
    ):
        return []
    taken = set(
        db.scalars(
            select(Appointment.start_time).where(
                Appointment.appointment_date == day, Appointment.cancelled_at.is_(None)
            )
        )
    )
    return [
        s.isoformat()
        for s in SLOTS
        if s not in taken and datetime.combine(day, s, tzinfo=current.tzinfo) > current
    ]


def appointment(db: Session, id: UUID, lock=False):
    query = select(Appointment).where(Appointment.id == id)
    if lock:
        query = query.with_for_update(of=Appointment)
    item = db.scalar(query)
    if not item:
        raise HTTPException(404, "This appointment could not be found.")
    return item


def eligible(item: Appointment):
    if item.cancelled_at or item.status != "Booked":
        raise HTTPException(409, "This appointment can no longer be changed.")
    if (
        datetime.combine(
            item.appointment_date, item.start_time, tzinfo=get_settings().timezone
        )
        <= now()
    ):
        raise HTTPException(409, "Only upcoming appointments can be changed.")


def audit(db: Session, item: Appointment, action: str, old=None, new=None):
    db.flush()
    db.add(
        AuditLog(appointment_id=item.id, action=action, old_value=old, new_value=new)
    )


def end_time(day, start):
    return (datetime.combine(day, start) + timedelta(minutes=30)).time()
