import re
from datetime import date, time, datetime
from uuid import UUID
from typing import Literal
from pydantic import BaseModel, ConfigDict, field_validator

Status = Literal["Booked", "Done", "No-show"]


def normalize_phone(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    if not re.fullmatch(r"\+?[\d\s().-]+", value, flags=re.ASCII):
        raise ValueError("Use digits and an optional leading + for the country code.")
    digits = re.sub(r"\D", "", value)
    if not 7 <= len(digits) <= 15:
        raise ValueError("Phone numbers need 7 to 15 digits.")
    return ("+" if value.startswith("+") else "") + digits


class ClientCreate(BaseModel):
    full_name: str
    phone: str | None = None

    @field_validator("full_name")
    @classmethod
    def name(cls, value):
        value = " ".join(value.split())
        if len(value) < 2 or len(value) > 100:
            raise ValueError("Please enter a name between 2 and 100 characters.")
        return value

    @field_validator("phone")
    @classmethod
    def phone_number(cls, value):
        return normalize_phone(value)


class ClientOut(ClientCreate):
    id: UUID
    model_config = ConfigDict(from_attributes=True)


class BookingIn(BaseModel):
    client_id: UUID
    appointment_date: date
    start_time: time
    status: Status = "Booked"


class RescheduleIn(BaseModel):
    appointment_date: date
    start_time: time


class StatusIn(BaseModel):
    status: Status


class AppointmentOut(BaseModel):
    id: UUID
    client_id: UUID
    appointment_date: date
    start_time: time
    end_time: time
    status: Status
    attendance_confirmation: bool
    confirmed_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime
    client: ClientOut
    model_config = ConfigDict(from_attributes=True)
