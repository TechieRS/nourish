import { describe, it, expect } from "vitest";
import { filterAppointments } from "../../pages/DashboardPage";
import type { Appointment } from "../../types";
const base = {
  id: "1",
  client_id: "c1",
  client: { id: "c1", full_name: "Riya Shah", phone: "9820011111" },
  appointment_date: "2026-10-28",
  start_time: "10:00:00",
  end_time: "10:30:00",
  status: "Booked",
  cancelled_at: null,
  attendance_confirmation: false,
  confirmed_at: null,
  created_at: "",
  updated_at: "",
} as Appointment;
const list = [
  base,
  { ...base, id: "2", status: "Done" as const, appointment_date: "2026-10-24" },
  { ...base, id: "3", cancelled_at: "2026-10-27T00:00:00Z" },
];
describe("dashboard filtering", () => {
  it("filters today in the configured practice date", () =>
    expect(
      filterAppointments(list, "Today", "", "2026-10-28").map((a) => a.id),
    ).toEqual(["1"]));
  it("filters status without cancelled records", () =>
    expect(
      filterAppointments(list, "Done", "", "2026-10-28").map((a) => a.id),
    ).toEqual(["2"]));
  it("searches names case insensitively and normalized phone digits", () => {
    expect(filterAppointments(list, "All", "riya", "2026-10-28")).toHaveLength(
      2,
    );
    expect(
      filterAppointments(list, "All", "98200 11111", "2026-10-28"),
    ).toHaveLength(2);
  });
  it("shows cancelled records only in their separate view", () =>
    expect(
      filterAppointments(list, "Cancelled", "", "2026-10-28").map((a) => a.id),
    ).toEqual(["3"]));
});
