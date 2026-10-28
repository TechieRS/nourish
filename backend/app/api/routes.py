from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import get_settings
from app.models.entities import Client, Appointment
from app.schemas.api import (
    ClientCreate,
    ClientOut,
    BookingIn,
    RescheduleIn,
    StatusIn,
    AppointmentOut,
    Status,
)
from app.services import scheduling as schedule

router = APIRouter(prefix="/api")


@router.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(select(1))
    return {"status": "ok", "database": "postgresql"}


@router.get("/config")
def config():
    current = schedule.now()
    return {
        "timezone": get_settings().app_timezone,
        "today": current.date().isoformat(),
        "now": current.isoformat(),
        "slot_duration": 30,
        "horizon_days": schedule.HORIZON,
        "closed_weekdays": [0],
    }


@router.get("/clients", response_model=list[ClientOut])
def clients(db: Session = Depends(get_db)):
    return list(
        db.scalars(select(Client).order_by(Client.created_at, Client.full_name))
    )


@router.post("/clients", response_model=ClientOut, status_code=201)
def create_client(data: ClientCreate, db: Session = Depends(get_db)):
    item = Client(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/availability")
def available(date: date, db: Session = Depends(get_db)):
    return {
        "date": date,
        "slots": schedule.availability(db, date),
        "timezone": get_settings().app_timezone,
    }


@router.get("/appointments", response_model=list[AppointmentOut])
def appointments(
    client_id: UUID | None = None,
    today: bool = False,
    status: Status | None = None,
    search: str = Query("", max_length=100),
    include_cancelled: bool = False,
    db: Session = Depends(get_db),
):
    query = select(Appointment).join(Client)
    if not include_cancelled:
        query = query.where(Appointment.cancelled_at.is_(None))
    if client_id:
        query = query.where(Appointment.client_id == client_id)
    if today:
        query = query.where(Appointment.appointment_date == schedule.now().date())
    if status:
        query = query.where(Appointment.status == status)
    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(
            or_(
                Client.full_name.ilike(f"%{escaped}%", escape="\\"),
                Client.phone.ilike(f"%{escaped}%", escape="\\"),
            )
        )
    return list(
        db.scalars(query.order_by(Appointment.appointment_date, Appointment.start_time))
    )


@router.get("/appointments/{id}", response_model=AppointmentOut)
def get_appointment(id: UUID, db: Session = Depends(get_db)):
    return schedule.appointment(db, id)


@router.post("/appointments", response_model=AppointmentOut, status_code=201)
def book(data: BookingIn, db: Session = Depends(get_db)):
    if not db.get(Client, data.client_id):
        raise HTTPException(404, "Please choose an existing client.")
    schedule.validate_slot(data.appointment_date, data.start_time)
    item = Appointment(
        **data.model_dump(),
        end_time=schedule.end_time(data.appointment_date, data.start_time),
    )
    db.add(item)
    schedule.audit(db, item, "booked", new=data.model_dump(mode="json"))
    db.commit()
    return schedule.appointment(db, item.id)


@router.post("/appointments/{id}/reschedule", response_model=AppointmentOut)
def reschedule(id: UUID, data: RescheduleIn, db: Session = Depends(get_db)):
    item = schedule.appointment(db, id, lock=True)
    schedule.eligible(item)
    schedule.validate_slot(data.appointment_date, data.start_time)
    old = {"date": str(item.appointment_date), "time": str(item.start_time)}
    item.appointment_date = data.appointment_date
    item.start_time = data.start_time
    item.end_time = schedule.end_time(data.appointment_date, data.start_time)
    item.attendance_confirmation = False
    item.confirmed_at = None
    schedule.audit(db, item, "rescheduled", old=old, new=data.model_dump(mode="json"))
    db.commit()
    return item


@router.post("/appointments/{id}/cancel", response_model=AppointmentOut)
def cancel(id: UUID, db: Session = Depends(get_db)):
    item = schedule.appointment(db, id, lock=True)
    if item.cancelled_at:
        return item
    schedule.eligible(item)
    item.cancelled_at = schedule.now()
    schedule.audit(db, item, "cancelled")
    db.commit()
    return item


@router.post("/appointments/{id}/confirm", response_model=AppointmentOut)
def confirm(id: UUID, db: Session = Depends(get_db)):
    item = schedule.appointment(db, id, lock=True)
    schedule.eligible(item)
    if not item.attendance_confirmation:
        item.attendance_confirmation = True
        item.confirmed_at = schedule.now()
        schedule.audit(db, item, "confirmed")
        db.commit()
    return item


@router.patch("/appointments/{id}/status", response_model=AppointmentOut)
def status(id: UUID, data: StatusIn, db: Session = Depends(get_db)):
    item = schedule.appointment(db, id, lock=True)
    if item.cancelled_at:
        raise HTTPException(409, "Cancelled appointments cannot be updated.")
    if item.status == data.status:
        return item
    if item.status != "Booked":
        raise HTTPException(
            409, "Completed or no-show consultations cannot be changed."
        )
    old = item.status
    item.status = data.status
    schedule.audit(
        db, item, "status_changed", old={"status": old}, new={"status": data.status}
    )
    db.commit()
    return item


@router.get("/dashboard/summary")
def summary(db: Session = Depends(get_db)):
    current = schedule.now()
    active = Appointment.cancelled_at.is_(None)
    upcoming = or_(
        Appointment.appointment_date > current.date(),
        (Appointment.appointment_date == current.date())
        & (Appointment.start_time > current.time().replace(tzinfo=None)),
    )

    def count(*clauses):
        return db.scalar(
            select(func.count()).select_from(Appointment).where(active, *clauses)
        )

    return {
        "today": count(Appointment.appointment_date == current.date()),
        "upcoming": count(upcoming, Appointment.status == "Booked"),
        "confirmed": count(
            upcoming,
            Appointment.status == "Booked",
            Appointment.attendance_confirmation.is_(True),
        ),
        "no_shows": count(Appointment.status == "No-show"),
    }
