import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { StatusBadge } from "./Common";
import { DatePicker } from "./DatePicker";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { AppointmentCard } from "./AppointmentCard";
import { api } from "../services/api";
import { theme } from "../theme";
import type { Appointment } from "../types";
vi.mock("../features/clients/ClientContext", () => ({
  useClient: () => ({
    config: {
      timezone: "Asia/Kolkata",
      today: "2026-10-28",
      now: "2026-10-28T08:00:00+05:30",
    },
  }),
}));
vi.mock("../services/api", () => ({
  api: {
    availability: vi.fn(),
    cancel: vi.fn(),
    confirm: vi.fn(),
    status: vi.fn(),
  },
}));
const a: Appointment = {
  id: "a1",
  client_id: "c1",
  client: { id: "c1", full_name: "Fictional Client", phone: null },
  appointment_date: "2099-10-29",
  start_time: "10:00:00",
  end_time: "10:30:00",
  status: "Booked",
  attendance_confirmation: false,
  confirmed_at: null,
  cancelled_at: null,
  created_at: "2026-10-28T00:00:00Z",
  updated_at: "2026-10-28T00:00:00Z",
};
function renderUI(ui: React.ReactElement) {
  return render(
    <ChakraProvider theme={theme}>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ChakraProvider>,
  );
}
beforeEach(() => vi.clearAllMocks());
describe("appointment components", () => {
  it.each(["Booked", "Done", "No-show"] as const)(
    "labels the %s status",
    (status) => {
      renderUI(<StatusBadge status={status} />);
      expect(screen.getByText(status)).toBeVisible();
    },
  );
  it("shows details and a reschedule link to the same appointment", () => {
    renderUI(<AppointmentCard appointment={a} />);
    expect(screen.getByText("10:00 AM · 30 min")).toBeVisible();
    expect(screen.getByRole("link", { name: "Reschedule" })).toHaveAttribute(
      "href",
      "/book?reschedule=a1",
    );
    expect(screen.getByText("Awaiting confirmation")).toBeVisible();
  });
  it("requires cancellation confirmation and supports keeping the appointment", async () => {
    const user = userEvent.setup();
    renderUI(<AppointmentCard appointment={a} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Cancel your consultation?")).toBeVisible();
    expect(api.cancel).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Keep appointment" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(api.cancel).not.toHaveBeenCalled();
  });
  it("persists cancellation only after the destructive action is chosen", async () => {
    vi.mocked(api.cancel).mockResolvedValue({
      ...a,
      cancelled_at: "2099-10-28T00:00:00Z",
    });
    renderUI(<AppointmentCard appointment={a} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Cancel appointment",
      }),
    );
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith("a1"));
  });
  it("confirms attendance using the API", async () => {
    vi.mocked(api.confirm).mockResolvedValue({
      ...a,
      attendance_confirmation: true,
    });
    renderUI(<AppointmentCard appointment={a} featured />);
    fireEvent.click(screen.getByRole("button", { name: "I’ll be there" }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledWith("a1"));
  });
  it("does not offer edit actions for completed appointments", () => {
    renderUI(<AppointmentCard appointment={{ ...a, status: "Done" }} />);
    expect(
      screen.queryByRole("link", { name: "Reschedule" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
  });
});
describe("date and time selection", () => {
  it("disables past dates and Sundays, and selects a valid date", () => {
    const change = vi.fn();
    renderUI(<DatePicker value="" onChange={change} today="2026-10-28" />);
    expect(
      screen.getByRole("button", { name: "Tuesday, October 27, 2026" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Sunday, October 25, 2026" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Thursday, October 29, 2026" }),
    );
    expect(change).toHaveBeenCalledWith("2026-10-29");
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(
      screen.getByRole("button", { name: "Sunday, November 1, 2026" }),
    ).toBeDisabled();
  });
  it("renders only backend availability and supports selecting a slot", async () => {
    vi.mocked(api.availability).mockResolvedValue({
      date: "2026-10-29",
      timezone: "Asia/Kolkata",
      slots: ["09:00:00", "14:00:00"],
    });
    const change = vi.fn();
    renderUI(
      <TimeSlotPicker date="2026-10-29" value="14:00:00" onChange={change} />,
    );
    await screen.findByRole("button", { name: "9:00 AM" });
    expect(
      screen.queryByRole("button", { name: "10:00 AM" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2:00 PM" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "9:00 AM" }));
    expect(change).toHaveBeenCalledWith("09:00:00");
  });
  it("shows an honest empty availability state", async () => {
    vi.mocked(api.availability).mockResolvedValue({
      date: "2026-10-29",
      timezone: "Asia/Kolkata",
      slots: [],
    });
    renderUI(<TimeSlotPicker date="2026-10-29" value="" onChange={() => {}} />);
    expect(
      await screen.findByText(/All slots are booked or unavailable/),
    ).toBeVisible();
  });
});
