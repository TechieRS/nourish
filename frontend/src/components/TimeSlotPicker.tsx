import { Box, Button, SimpleGrid, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { ErrorState, LoadingSkeleton } from "./Common";
import { dayLabel, timeLabel } from "../utils/dates";
export function TimeSlotPicker({
  date,
  value,
  onChange,
}: {
  date: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const query = useQuery({
    queryKey: ["availability", date],
    queryFn: () => api.availability(date),
    enabled: !!date,
    staleTime: 0,
    refetchInterval: 15000,
  });
  if (!date)
    return (
      <Text color="muted" fontSize="sm">
        Choose a date to see available times.
      </Text>
    );
  if (query.isPending) return <LoadingSkeleton />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const slots = query.data?.slots || [];
  return (
    <Box>
      <Text fontSize="sm" mb={4} color="muted">
        {dayLabel(date, "EEEE, MMMM d")}
      </Text>
      {slots.length ? (
        <SimpleGrid columns={{ base: 2, sm: 3 }} spacing={3}>
          {slots.map((s) => (
            <Button
              key={s}
              variant={s === value ? "solid" : "outline"}
              aria-pressed={s === value}
              rounded="xl"
              onClick={() => onChange(s)}
              fontSize="sm"
            >
              {timeLabel(s)}
            </Button>
          ))}
        </SimpleGrid>
      ) : (
        <Box bg="brand.50" rounded="xl" p={5}>
          <Text fontSize="sm">
            All slots are booked or unavailable for this date. Try another day.
          </Text>
        </Box>
      )}
      <Text mt={5} fontSize="xs" color="muted">
        Availability updates every 15 seconds. Your time is reserved once
        booking is complete.
      </Text>
    </Box>
  );
}
