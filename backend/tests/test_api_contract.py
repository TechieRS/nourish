from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.config import Settings
from app.db.session import SessionLocal, get_db
from app.main import app
from app.models.entities import AuditLog


def book(api, client_id, **overrides):
    return api.post(
        "/api/appointments",
        json={
            "client_id": client_id,
            "appointment_date": "2026-10-29",
            "start_time": "09:00:00",
            **overrides,
        },
    )


@pytest.mark.parametrize(
    "path", ["/", "/health", "/api/health", "/docs", "/openapi.json"]
)
def test_service_endpoints(api, path):
    response = api.get(path)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_practice_configuration(api):
    config = api.get("/api/config").json()
    assert config == {
        "timezone": "Asia/Kolkata",
        "today": "2026-10-28",
        "now": "2026-10-28T08:00:00+05:30",
        "slot_duration": 30,
        "horizon_days": 90,
        "closed_weekdays": [0],
    }


@pytest.mark.parametrize(
    "phone,normalized",
    [
        ("+44 (7700) 900-123", "+447700900123"),
        ("98200 11111", "9820011111"),
        ("", None),
        ("   ", None),
        (None, None),
    ],
)
def test_client_normalization(api, phone, normalized):
    response = api.post(
        "/api/clients", json={"full_name": "  Demo   Person  ", "phone": phone}
    )
    assert response.status_code == 201
    assert response.json()["full_name"] == "Demo Person"
    assert response.json()["phone"] == normalized
    assert api.get("/api/clients").json() == [response.json()]


@pytest.mark.parametrize(
    "payload",
    [
        {"full_name": " "},
        {"full_name": "A" * 101},
        {"full_name": 123},
        {"full_name": "Valid Name", "phone": "123456"},
        {"full_name": "Valid Name", "phone": "1" * 16},
        {"full_name": "Valid Name", "phone": "１２３４５６７"},
        {"full_name": "Valid Name", "phone": "++123456789"},
    ],
)
def test_invalid_clients(api, payload):
    assert api.post("/api/clients", json=payload).status_code == 422
    assert api.get("/api/clients").json() == []


@pytest.mark.parametrize(
    "day,count",
    [
        ("2026-10-28", 12),
        ("2026-11-01", 0),
        ("2026-10-27", 0),
        ((date(2026, 10, 28) + timedelta(days=90)).isoformat(), 12),
        ((date(2026, 10, 28) + timedelta(days=91)).isoformat(), 0),
    ],
)
def test_availability_boundaries(api, day, count):
    response = api.get("/api/availability", params={"date": day})
    assert response.status_code == 200
    assert len(response.json()["slots"]) == count


@pytest.mark.parametrize(
    "path",
    [
        "/api/availability",
        "/api/availability?date=bad",
        "/api/appointments?client_id=bad",
        "/api/appointments?status=bad",
        "/api/appointments?today=bad",
        "/api/appointments?search=" + "x" * 101,
    ],
)
def test_invalid_queries(api, path):
    assert api.get(path).status_code == 422


def test_missing_client_and_required_booking_fields(api):
    assert book(api, str(uuid4())).status_code == 404
    assert api.post("/api/appointments", json={}).status_code == 422


@pytest.mark.parametrize(
    "change",
    [
        {"start_time": "08:30"},
        {"start_time": "12:00"},
        {"start_time": "17:00"},
        {"start_time": "10:00:00+05:30"},
        {"start_time": "10:00:00.000001"},
        {"appointment_date": "2026-10-28", "start_time": "08:00"},
        {"status": "Cancelled"},
    ],
)
def test_booking_rejects_invalid_schedule_or_status(api, client_id, change):
    assert book(api, client_id, **change).status_code == 422
    assert api.get("/api/appointments").json() == []


@pytest.mark.parametrize(
    "action,method,payload",
    [
        (
            "reschedule",
            "post",
            {"appointment_date": "2026-10-29", "start_time": "10:00"},
        ),
        ("cancel", "post", None),
        ("confirm", "post", None),
        ("status", "patch", {"status": "Done"}),
    ],
)
def test_missing_appointment_mutations(api, action, method, payload):
    for identity, expected in [("bad", 422), (str(uuid4()), 404)]:
        response = getattr(api, method)(
            f"/api/appointments/{identity}/{action}", json=payload
        )
        assert response.status_code == expected


def test_audit_and_idempotent_mutations(api, client_id):
    saved = book(api, client_id).json()
    endpoint = f"/api/appointments/{saved['id']}"
    assert api.get(endpoint).json() == saved
    for _ in range(2):
        assert api.post(endpoint + "/confirm").status_code == 200
    assert api.patch(endpoint + "/status", json={"status": "Booked"}).status_code == 200
    for _ in range(2):
        assert api.post(endpoint + "/cancel").status_code == 200
    with SessionLocal() as db:
        assert list(
            db.scalars(select(AuditLog.action).order_by(AuditLog.created_at))
        ) == [
            "booked",
            "confirmed",
            "cancelled",
        ]
    assert api.get("/api/dashboard/summary").json() == {
        "today": 0,
        "upcoming": 0,
        "confirmed": 0,
        "no_shows": 0,
    }


def test_second_client_filter_and_literal_search(api, client_id):
    other = api.post("/api/clients", json={"full_name": r"Demo %_\\ Other"}).json()
    book(api, client_id)
    book(api, other["id"], start_time="10:00")
    assert (
        len(api.get("/api/appointments", params={"client_id": other["id"]}).json()) == 1
    )
    assert len(api.get("/api/appointments", params={"search": "%_\\"}).json()) == 1
    assert len(api.get("/api/appointments", params={"search": "447700"}).json()) == 1


def test_database_failure_is_friendly_and_has_cors(api):
    def unavailable():
        raise OperationalError(
            "redacted query", {}, Exception("private database details")
        )
        yield  # dependency generator

    app.dependency_overrides[get_db] = unavailable
    try:
        response = api.get("/api/health", headers={"Origin": "http://localhost:5173"})
        assert response.status_code == 503
        assert (
            response.headers["access-control-allow-origin"] == "http://localhost:5173"
        )
        assert "private" not in response.text
        assert "temporarily unavailable" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_unexpected_integrity_constraint_is_sanitized(api):
    def conflict():
        raise IntegrityError(
            "redacted query", {}, Exception("private database details")
        )
        yield

    app.dependency_overrides[get_db] = conflict
    try:
        response = api.get("/api/health")
        assert response.status_code == 409
        assert "private" not in response.text
    finally:
        app.dependency_overrides.clear()


def test_cors_accepts_allowed_origin_and_rejects_others(api):
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }
    assert api.options("/api/appointments", headers=headers).status_code == 200
    headers["Origin"] = "https://untrusted.example"
    rejected = api.options("/api/appointments", headers=headers)
    assert rejected.status_code == 400
    assert "access-control-allow-origin" not in rejected.headers


def test_hosted_cors_normalizes_trailing_slashes():
    settings = Settings(
        _env_file=None,
        frontend_url="https://demo.vercel.app/",
        cors_origins=" https://preview.vercel.app/,https://demo.vercel.app/ ",
    )
    demo = FastAPI()
    demo.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["POST"],
        allow_headers=["Content-Type"],
    )
    with TestClient(demo) as client:
        response = client.options(
            "/api/appointments",
            headers={
                "Origin": "https://demo.vercel.app",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://demo.vercel.app"


@pytest.mark.parametrize(
    "origin",
    [
        "*",
        "https://demo.test/path",
        "javascript:alert(1)",
        "https://user:pass@demo.test",
        "https://demo.test?x=1",
    ],
)
def test_invalid_cors_configuration_fails_at_startup(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, frontend_url=origin)


@pytest.mark.parametrize(
    "url", ["postgres://u:p@db/nourish", "postgresql://u:p@db/nourish"]
)
def test_postgres_driver_normalization(url):
    assert Settings(_env_file=None, database_url=url).database_url.startswith(
        "postgresql+psycopg://"
    )
