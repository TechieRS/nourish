import { useState } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  IconButton,
  Text,
} from "@chakra-ui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  parseISO,
  startOfMonth,
} from "date-fns";
export function DatePicker({
  value,
  onChange,
  today,
  horizon = 90,
}: {
  value: string;
  onChange: (v: string) => void;
  today: string;
  horizon?: number;
}) {
  const [month, setMonth] = useState(() =>
    startOfMonth(parseISO(value || today)),
  );
  const start = startOfMonth(month);
  const days: (Date | null)[] = [
    ...Array.from({ length: getDay(start) }, () => null),
    ...Array.from({ length: endOfMonth(month).getDate() }, (_, i) =>
      addDays(start, i),
    ),
  ];
  return (
    <Box>
      <Flex align="center" justify="space-between" mb={5}>
        <Heading fontSize="lg">{format(month, "MMMM yyyy")}</Heading>
        <Flex gap={2}>
          <IconButton
            aria-label="Previous month"
            variant="ghost"
            icon={<ChevronLeft size={19} />}
            onClick={() => setMonth(addMonths(month, -1))}
            isDisabled={isSameMonth(month, parseISO(today))}
          />
          <IconButton
            aria-label="Next month"
            variant="ghost"
            icon={<ChevronRight size={19} />}
            onClick={() => setMonth(addMonths(month, 1))}
            isDisabled={
              startOfMonth(addMonths(month, 1)) >
              addDays(parseISO(today), horizon)
            }
          />
        </Flex>
      </Flex>
      <Grid templateColumns="repeat(7,minmax(0,1fr))" gap={{ base: 1, md: 2 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <Text key={i} textAlign="center" fontSize="xs" color="muted" mb={2}>
            {d}
          </Text>
        ))}
        {days.map((day, i) => {
          if (!day) return <Box key={`empty-${i}`} />;
          const iso = format(day, "yyyy-MM-dd"),
            disabled =
              iso < today ||
              getDay(day) === 0 ||
              differenceInCalendarDays(day, parseISO(today)) > horizon;
          return (
            <Button
              key={iso}
              aria-label={format(day, "EEEE, MMMM d, yyyy")}
              aria-pressed={iso === value}
              isDisabled={disabled}
              onClick={() => onChange(iso)}
              variant={iso === value ? "solid" : "ghost"}
              rounded="xl"
              p={0}
              minW={0}
              w="100%"
              h={{ base: "40px", sm: "44px" }}
              fontSize="sm"
              border={iso === today ? "1px solid" : "none"}
              borderColor="brand.200"
            >
              {day.getDate()}
            </Button>
          );
        })}
      </Grid>
      <Text fontSize="xs" color="muted" mt={5}>
        Monday–Saturday · 30-minute consultations
        <br />
        Unavailable dates are dimmed. All times are practice local time.
      </Text>
    </Box>
  );
}
