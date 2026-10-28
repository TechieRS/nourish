import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Search,
  UserRoundX,
} from "lucide-react";
import {
  useAppointments,
  useAppointmentAction,
} from "../hooks/useAppointments";
import { useClient } from "../features/clients/ClientContext";
import { api } from "../services/api";
import {
  AttendanceBadge,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeading,
  panel,
  StatusBadge,
} from "../components/Common";
import { dayLabel, timeLabel } from "../utils/dates";
import type { Appointment, Status } from "../types";
export type DashboardFilter = "All" | "Today" | Status | "Cancelled";
export function filterAppointments(
  list: Appointment[],
  filter: DashboardFilter,
  search: string,
  today: string,
) {
  const needle = search.trim().toLowerCase();
  return list.filter(
    (a) =>
      (filter === "Cancelled" ? !!a.cancelled_at : !a.cancelled_at) &&
      (filter === "All" ||
        filter === "Cancelled" ||
        (filter === "Today"
          ? a.appointment_date === today
          : a.status === filter)) &&
      (!needle ||
        a.client.full_name.toLowerCase().includes(needle) ||
        (a.client.phone || "").includes(needle.replace(/[\s()-]/g, ""))),
  );
}
export function DashboardPage() {
  const { config } = useClient(),
    query = useAppointments(undefined, true),
    summary = useQuery({
      queryKey: ["summary"],
      queryFn: api.summary,
      refetchInterval: 15000,
    }),
    cancelled = useQuery({
      queryKey: ["appointments", "cancelled"],
      queryFn: () => api.appointments("?include_cancelled=true"),
      refetchInterval: 15000,
    }),
    action = useAppointmentAction(),
    [filter, setFilter] = useState<DashboardFilter>("All"),
    [search, setSearch] = useState("");
  const list = useMemo(
    () =>
      filterAppointments(
        filter === "Cancelled" ? cancelled.data || [] : query.data || [],
        filter,
        search,
        config?.today || "",
      ),
    [query.data, cancelled.data, filter, search, config?.today],
  );
  if (!config) return null;
  return (
    <>
      <PageHeading
        eyebrow="The practitioner’s space"
        title="Hello, Doctor"
        description="A clear schedule. More room to care."
        action={
          <Button
            as={Link}
            to="/book?mode=nutritionist"
            leftIcon={<CalendarPlus size={17} />}
          >
            Add appointment
          </Button>
        }
      />
      <Flex bg="peach" rounded="xl" px={4} py={3} mb={6} gap={2} align="start">
        <Badge colorScheme="orange" textTransform="none" whiteSpace="nowrap">
          Public demo
        </Badge>
        <Text fontSize="xs" lineHeight="1.8">
          Fictional client records. This dashboard is open for review;
          production requires authentication and role-based access.
        </Text>
      </Flex>
      {summary.error ? (
        <ErrorState
          error={summary.error}
          retry={() => void summary.refetch()}
        />
      ) : (
        <SimpleGrid
          columns={{ base: 2, lg: 4 }}
          spacing={{ base: 3, md: 5 }}
          mb={8}
        >
          {[
            { key: "today", label: "Today’s appointments", icon: CalendarDays },
            { key: "upcoming", label: "Upcoming consultations", icon: Clock },
            {
              key: "confirmed",
              label: "Confirmed upcoming",
              icon: CheckCircle2,
            },
            { key: "no_shows", label: "No-shows · all time", icon: UserRoundX },
          ].map((s, i) => (
            <Box key={s.key} {...panel} p={{ base: 4, md: 6 }}>
              <Flex justify="space-between" align="center" mb={4}>
                <s.icon size={19} color={i === 3 ? "#A34D4D" : "#557C68"} />
                <Text fontSize="10px" color="muted">
                  {i === 0 ? "TODAY" : i === 3 ? "HISTORY" : "UPCOMING"}
                </Text>
              </Flex>
              <Text fontSize="32px" fontFamily="heading" fontWeight="600">
                {summary.data
                  ? summary.data[s.key as keyof typeof summary.data]
                  : "—"}
              </Text>
              <Text fontSize="xs" color="muted" mt={1}>
                {s.label}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      )}
      <Box {...panel}>
        <Flex
          justify="space-between"
          align={{ base: "start", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap={4}
          mb={5}
        >
          <Box>
            <Heading fontSize="23px">Consultation schedule</Heading>
            <Text fontSize="xs" color="muted" mt={2}>
              {dayLabel(config.today)} · {config.timezone}
            </Text>
          </Box>
          <InputGroup maxW={{ base: "100%", md: "280px" }}>
            <InputLeftElement pointerEvents="none" h="48px">
              <Search size={17} color="#606F65" />
            </InputLeftElement>
            <Input
              aria-label="Search clients"
              placeholder="Search name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fontSize="sm"
            />
          </InputGroup>
        </Flex>
        <Flex
          gap={2}
          wrap="wrap"
          mb={6}
          role="group"
          aria-label="Appointment filters"
        >
          {(
            [
              "All",
              "Today",
              "Booked",
              "Done",
              "No-show",
              "Cancelled",
            ] as DashboardFilter[]
          ).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "solid" : "ghost"}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </Flex>
        {query.isPending || (filter === "Cancelled" && cancelled.isPending) ? (
          <LoadingSkeleton />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : filter === "Cancelled" && cancelled.error ? (
          <ErrorState
            error={cancelled.error}
            retry={() => void cancelled.refetch()}
          />
        ) : list.length ? (
          <Stack spacing={0}>
            {list.map((a) => (
              <Flex
                key={a.id}
                py={5}
                borderTop="1px solid #E5EAE3"
                direction={{ base: "column", md: "row" }}
                gap={4}
                align={{ base: "start", md: "center" }}
              >
                <Box minW="180px" flex={1}>
                  <Text fontWeight="600" mb={1}>
                    {a.client.full_name}
                  </Text>
                  <Text fontSize="xs" color="muted">
                    {a.client.phone || "No phone provided"}
                  </Text>
                </Box>
                <Box minW="150px">
                  <Text fontSize="sm">
                    {dayLabel(a.appointment_date, "EEE, MMM d, yyyy")}
                  </Text>
                  <Text fontSize="xs" color="muted" mt={1}>
                    {timeLabel(a.start_time)} · 30 min
                  </Text>
                </Box>
                <Stack minW="165px" align="start" spacing={2}>
                  <StatusBadge status={a.status} />
                  {a.cancelled_at ? (
                    <Badge
                      colorScheme="gray"
                      rounded="full"
                      textTransform="none"
                    >
                      Cancelled
                    </Badge>
                  ) : (
                    <AttendanceBadge confirmed={a.attendance_confirmation} />
                  )}
                </Stack>
                <Box w={{ base: "100%", md: "145px" }}>
                  <Select
                    aria-label={`Status for ${a.client.full_name} on ${a.appointment_date} at ${a.start_time}`}
                    fontSize="sm"
                    size="sm"
                    minH="44px"
                    rounded="xl"
                    value={a.status}
                    isDisabled={
                      action.isPending ||
                      !!a.cancelled_at ||
                      a.status !== "Booked"
                    }
                    onChange={(e) =>
                      action.mutate({
                        id: a.id,
                        action: "status",
                        status: e.target.value as Status,
                      })
                    }
                  >
                    <option>Booked</option>
                    <option>Done</option>
                    <option>No-show</option>
                  </Select>
                </Box>
              </Flex>
            ))}
          </Stack>
        ) : (
          <EmptyState
            title={
              filter === "Today"
                ? "Your schedule is clear today."
                : "No consultations match this view."
            }
            description="Try another filter or add an appointment."
            booking={false}
          />
        )}
      </Box>
      <Text fontSize="xs" color="muted" mt={5}>
        Changes are saved to the shared database. Both experiences refresh every
        15 seconds and when you return to the tab.
      </Text>
    </>
  );
}
