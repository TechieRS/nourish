export type Status = "Booked" | "Done" | "No-show";
export interface Client {
  id: string;
  full_name: string;
  phone: string | null;
}
export interface Appointment {
  id: string;
  client_id: string;
  client: Client;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: Status;
  attendance_confirmation: boolean;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface PracticeConfig {
  timezone: string;
  today: string;
  now: string;
  slot_duration: number;
  horizon_days: number;
  closed_weekdays: number[];
}
export interface Booking {
  client_id: string;
  appointment_date: string;
  start_time: string;
  status?: Status;
}
export interface Summary {
  today: number;
  upcoming: number;
  confirmed: number;
  no_shows: number;
}
