import type {
  Appointment,
  Booking,
  Client,
  PracticeConfig,
  Status,
  Summary,
} from "../types";
const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
      signal: init?.signal ?? AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiError(
      "We couldn’t reach the booking service. Please check your connection and try again.",
      0,
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      typeof body.detail === "string"
        ? body.detail
        : response.status === 422
          ? "Please check your details and choose an available time."
          : "Something went wrong. Please try again.",
      response.status,
    );
  }
  return response.json();
}
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
export const api = {
  config: () => request<PracticeConfig>("/config"),
  clients: () => request<Client[]>("/clients"),
  createClient: (data: { full_name: string; phone: string | null }) =>
    post<Client>("/clients", data),
  appointment: (id: string) => request<Appointment>(`/appointments/${id}`),
  appointments: (params = "") =>
    request<Appointment[]>(`/appointments${params}`),
  availability: (date: string) =>
    request<{ slots: string[]; date: string; timezone: string }>(
      `/availability?date=${date}`,
    ),
  book: (data: Booking) => post<Appointment>("/appointments", data),
  reschedule: (
    id: string,
    data: { appointment_date: string; start_time: string },
  ) => post<Appointment>(`/appointments/${id}/reschedule`, data),
  cancel: (id: string) => post<Appointment>(`/appointments/${id}/cancel`),
  confirm: (id: string) => post<Appointment>(`/appointments/${id}/confirm`),
  status: (id: string, status: Status) =>
    request<Appointment>(`/appointments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  summary: () => request<Summary>("/dashboard/summary"),
};
