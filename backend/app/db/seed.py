"""Deterministic, idempotent normalization of the exact five assignment records."""

from datetime import datetime, timedelta
from uuid import uuid5, NAMESPACE_URL
from sqlalchemy.dialects.postgresql import insert
from app.db.session import SessionLocal
from app.models.entities import Client, Appointment
from app.schemas.api import normalize_phone

RAW = [
    ("Riya Shah", "98200 11111", "24/10/2026", "%d/%m/%Y", "10:00", "%H:%M", "Booked"),
    (
        "Arjun Mehta",
        "98200 22222",
        "2026-10-24",
        "%Y-%m-%d",
        "11:30am",
        "%I:%M%p",
        "Booked",
    ),
    ("Riya Shah", "9820011111", "25-10-2026", "%d-%m-%Y", "4 pm", "%I %p", "Booked"),
    ("Meera Iyer", None, "23/10/2026", "%d/%m/%Y", "09:00", "%H:%M", "Done"),
    ("Kabir Rao", "98200 33333", "22/10/2026", "%d/%m/%Y", "14:00", "%H:%M", "No-show"),
]


def normalized():
    for name, phone, day, df, hour, tf, status in RAW:
        yield (
            name,
            normalize_phone(phone),
            datetime.strptime(day, df).date(),
            datetime.strptime(hour, tf).time(),
            status,
        )


def seed(db):
    for index, (name, phone, day, hour, status) in enumerate(normalized()):
        client_id = uuid5(NAMESPACE_URL, f"nourish:sample-client:{name}")
        db.execute(
            insert(Client)
            .values(id=client_id, full_name=name, phone=phone)
            .on_conflict_do_nothing(index_elements=["id"])
        )
        db.execute(
            insert(Appointment)
            .values(
                id=uuid5(NAMESPACE_URL, f"nourish:sample-appointment:{index}"),
                client_id=client_id,
                appointment_date=day,
                start_time=hour,
                end_time=(datetime.combine(day, hour) + timedelta(minutes=30)).time(),
                status=status,
                attendance_confirmation=False,
            )
            .on_conflict_do_nothing(index_elements=["id"])
        )
    db.commit()


if __name__ == "__main__":
    with SessionLocal() as db:
        seed(db)
    print(
        "Assignment seed loaded (4 fictional clients, 5 appointments; existing records preserved)."
    )
