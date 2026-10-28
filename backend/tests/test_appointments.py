from datetime import date
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from fastapi.testclient import TestClient
from sqlalchemy import select, func, text
from app.main import app
from app.db.session import SessionLocal, engine
from app.db.seed import seed, normalized
from app.models.entities import Appointment, Client, AuditLog

DAY = "2026-10-29"


def booking(api, client_id, time="10:00:00", date=DAY):
    return api.post(
        "/api/appointments",
        json={"client_id": client_id, "appointment_date": date, "start_time": time},
    )


def test_successful_booking(api, client_id):
    response = booking(api, client_id)
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["end_time"] == "10:30:00" and saved["status"] == "Booked"
    assert saved["client"]["phone"] == "+447700900123"
    assert (
        api.get("/api/appointments", params={"client_id": client_id}).json()[0]["id"]
        == saved["id"]
    )
    assert (
        "10:00:00"
        not in api.get("/api/availability", params={"date": DAY}).json()["slots"]
    )
    assert response.headers["cache-control"] == "no-store"
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(AuditLog)) == 1


def test_duplicate_booking_rejected(api, client_id):
    assert booking(api, client_id).status_code == 201
    conflict = booking(api, client_id)
    assert conflict.status_code == 409 and "just booked" in conflict.json()["detail"]


def test_concurrent_booking_single_winner(api, client_id):
    barrier = Barrier(2)

    def attempt(_):
        with TestClient(app) as client:
            barrier.wait(timeout=5)
            return booking(client, client_id).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, range(2)))
    assert sorted(results) == [201, 409]
    assert len(api.get("/api/appointments").json()) == 1


def test_reschedule_releases_old_slot_and_resets_confirmation(api, client_id):
    original = booking(api, client_id).json()
    api.post(f"/api/appointments/{original['id']}/confirm")
    moved = api.post(
        f"/api/appointments/{original['id']}/reschedule",
        json={"appointment_date": DAY, "start_time": "11:00:00"},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["id"] == original["id"] and moved.json()["confirmed_at"] is None
    assert moved.json()["attendance_confirmation"] is False
    slots = api.get("/api/availability", params={"date": DAY}).json()["slots"]
    assert "10:00:00" in slots and "11:00:00" not in slots
    assert len(api.get("/api/appointments").json()) == 1


def test_failed_reschedule_preserves_original(api, client_id):
    original = booking(api, client_id).json()
    booking(api, client_id, "11:00:00")
    response = api.post(
        f"/api/appointments/{original['id']}/reschedule",
        json={"appointment_date": DAY, "start_time": "11:00:00"},
    )
    assert response.status_code == 409
    assert (
        api.get(f"/api/appointments/{original['id']}").json()["start_time"]
        == "10:00:00"
    )
    assert len(api.get("/api/appointments").json()) == 2


def test_cancellation_is_soft_and_releases_slot(api, client_id):
    a = booking(api, client_id).json()
    response = api.post(f"/api/appointments/{a['id']}/cancel")
    assert response.status_code == 200 and response.json()["cancelled_at"]
    assert api.get("/api/appointments").json() == []
    assert len(api.get("/api/appointments?include_cancelled=true").json()) == 1
    assert booking(api, client_id).status_code == 201
    assert api.post(f"/api/appointments/{a['id']}/cancel").status_code == 200


def test_status_update_and_terminal_state(api, client_id):
    a = booking(api, client_id).json()
    assert (
        api.patch(
            f"/api/appointments/{a['id']}/status", json={"status": "Done"}
        ).json()["status"]
        == "Done"
    )
    assert api.get("/api/appointments").json()[0]["status"] == "Done"
    assert (
        api.patch(
            f"/api/appointments/{a['id']}/status", json={"status": "Booked"}
        ).status_code
        == 409
    )
    assert api.post(f"/api/appointments/{a['id']}/confirm").status_code == 409


def test_attendance_confirmation_persisted_and_idempotent(api, client_id):
    a = booking(api, client_id).json()
    confirmed = api.post(f"/api/appointments/{a['id']}/confirm").json()
    assert confirmed["attendance_confirmation"] and confirmed["confirmed_at"]
    again = api.post(f"/api/appointments/{a['id']}/confirm").json()
    assert again["confirmed_at"] == confirmed["confirmed_at"]
    assert api.get("/api/dashboard/summary").json()["confirmed"] == 1


def test_missing_phone_is_null(api):
    c = api.post(
        "/api/clients", json={"full_name": "Meera Example", "phone": None}
    ).json()
    assert c["phone"] is None and booking(api, c["id"]).status_code == 201


def test_sample_normalization_and_idempotence(api):
    rows = list(normalized())
    assert rows[0][1] == "9820011111" and str(rows[0][2]) == "2026-10-24"
    assert str(rows[1][3]) == "11:30:00"
    assert str(rows[2][2]) == "2026-10-25" and str(rows[2][3]) == "16:00:00"
    assert rows[3][1] is None
    with SessionLocal() as db:
        seed(db)
        seed(db)
        assert db.scalar(select(func.count()).select_from(Client)) == 4
        assert db.scalar(select(func.count()).select_from(Appointment)) == 5
        riya = db.scalars(
            select(Appointment).join(Client).where(Client.full_name == "Riya Shah")
        ).all()
        assert len(riya) == 2 and riya[0].client_id == riya[1].client_id
        assert all(a.status == "Booked" for a in riya)
    assert api.get("/api/dashboard/summary").json()["no_shows"] == 1


def test_invalid_slots_and_unknown_ids(api, client_id):
    for date, time in [
        ("2026-10-25", "10:00"),
        (DAY, "10:15"),
        ("2026-11-01", "10:00"),
        ("2027-10-29", "10:00"),
        (DAY, "10:00:01"),
    ]:
        assert booking(api, client_id, time, date).status_code == 422
    assert api.get("/api/appointments/not-a-uuid").status_code == 422
    assert (
        api.get("/api/appointments/00000000-0000-0000-0000-000000000000").status_code
        == 404
    )
    assert (
        api.post("/api/clients", json={"full_name": "A", "phone": "abc"}).status_code
        == 422
    )


def test_today_search_status_filters(api, client_id):
    booking(api, client_id, date="2026-10-28")
    other = booking(api, client_id, "11:00:00").json()
    api.patch(f"/api/appointments/{other['id']}/status", json={"status": "No-show"})
    assert len(api.get("/api/appointments?today=true").json()) == 1
    assert len(api.get("/api/appointments?status=No-show").json()) == 1
    assert len(api.get("/api/appointments?search=Fictional").json()) == 2
    assert len(api.get("/api/appointments?search=%25").json()) == 0
    assert api.get("/api/dashboard/summary").json() == {
        "today": 1,
        "upcoming": 1,
        "confirmed": 0,
        "no_shows": 1,
    }


def test_cancelled_and_past_states_cannot_be_mutated(api, client_id):
    item = booking(api, client_id).json()
    api.post(f"/api/appointments/{item['id']}/cancel")
    assert (
        api.patch(
            f"/api/appointments/{item['id']}/status", json={"status": "Done"}
        ).status_code
        == 409
    )
    assert api.post(f"/api/appointments/{item['id']}/confirm").status_code == 409
    with SessionLocal() as db:
        seed(db)
        past = db.scalar(
            select(Appointment).where(
                Appointment.status == "Booked",
                Appointment.appointment_date < date(2026, 10, 28),
            )
        )
        past_id = past.id
    assert api.post(f"/api/appointments/{past_id}/cancel").status_code == 409


def test_database_grid_constraint_blocks_off_grid_writes(api, client_id):
    import pytest
    from sqlalchemy.exc import IntegrityError

    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO appointments (id,client_id,appointment_date,start_time,end_time,status,attendance_confirmation) VALUES (gen_random_uuid(),:id,'2026-10-29','10:15','10:45','Booked',false)"
                ),
                {"id": client_id},
            )
