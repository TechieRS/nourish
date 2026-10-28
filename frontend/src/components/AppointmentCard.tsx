import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import {
  CalendarDays,
  Clock,
  Video,
  ArrowRight,
  Check,
  CalendarClock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import type { Appointment } from "../types";
import { useClient } from "../features/clients/ClientContext";
import { useAppointmentAction } from "../hooks/useAppointments";
import { isFuture, timeLabel, dayLabel } from "../utils/dates";
import { AttendanceBadge, panel, StatusBadge } from "./Common";
export function AppointmentCard({
  appointment: a,
  featured = false,
}: {
  appointment: Appointment;
  featured?: boolean;
}) {
  const { config } = useClient(),
    action = useAppointmentAction(),
    dialog = useDisclosure(),
    cancelRef = useRef<HTMLButtonElement>(null);
  const eligible =
    !!config && isFuture(a, config) && a.status === "Booked" && !a.cancelled_at;
  return (
    <Box {...panel} borderColor={featured ? "brand.200" : "#E5EAE3"}>
      <Flex gap={4} align="start">
        <Stack
          bg="brand.50"
          rounded="xl"
          minW="64px"
          py={2}
          align="center"
          spacing={0}
        >
          <Text
            fontSize="10px"
            textTransform="uppercase"
            color="brand.600"
            fontWeight="600"
          >
            {format(parseISO(a.appointment_date), "MMM")}
          </Text>
          <Text fontSize="27px" fontFamily="heading" fontWeight="600">
            {format(parseISO(a.appointment_date), "dd")}
          </Text>
          <Text fontSize="10px" color="muted">
            {format(parseISO(a.appointment_date), "EEE")}
          </Text>
        </Stack>
        <Box flex={1} minW={0}>
          <Flex justify="space-between" gap={2} wrap="wrap" mb={2}>
            <Heading fontSize={{ base: "lg", md: "xl" }}>
              Nutrition consultation
            </Heading>
            <StatusBadge status={a.status} />
          </Flex>
          <Text color="muted" fontSize="sm" mb={3}>
            Personalized care, just for you
          </Text>
          <Flex
            gap={{ base: 2, md: 5 }}
            wrap="wrap"
            fontSize="xs"
            color="muted"
          >
            <HStack>
              <Clock size={14} />
              <Text>{timeLabel(a.start_time)} · 30 min</Text>
            </HStack>
            <HStack>
              <Video size={14} />
              <Text>Online consultation</Text>
            </HStack>
          </Flex>
        </Box>
      </Flex>
      {eligible && (
        <>
          <Divider my={5} />
          <Flex justify="space-between" gap={3} wrap="wrap" align="center">
            <AttendanceBadge confirmed={a.attendance_confirmation} />
            <HStack spacing={1}>
              <Button
                as={Link}
                to={`/book?reschedule=${a.id}`}
                variant="ghost"
                size="sm"
                leftIcon={<CalendarClock size={14} />}
              >
                Reschedule
              </Button>
              <Button
                variant="ghost"
                size="sm"
                color="muted"
                onClick={dialog.onOpen}
              >
                Cancel
              </Button>
            </HStack>
          </Flex>
          {!a.attendance_confirmation && featured && (
            <Box mt={4} bg="brand.50" rounded="xl" p={4}>
              <Text fontSize="sm" fontWeight="600" mb={1}>
                A small yes makes a big difference.
              </Text>
              <Text fontSize="xs" color="muted" mb={3}>
                Please confirm you’ll attend so we can prepare for you.
              </Text>
              <Button
                size="sm"
                onClick={() => action.mutate({ id: a.id, action: "confirm" })}
                isLoading={action.isPending}
                leftIcon={<Check size={16} />}
              >
                I’ll be there
              </Button>
            </Box>
          )}
        </>
      )}
      <AlertDialog
        isOpen={dialog.isOpen}
        leastDestructiveRef={cancelRef}
        onClose={dialog.onClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Cancel your consultation?</AlertDialogHeader>
            <AlertDialogBody>
              Your appointment on {dayLabel(a.appointment_date)} at{" "}
              {timeLabel(a.start_time)} will be cancelled. Your slot will become
              available for someone else.
            </AlertDialogBody>
            <AlertDialogFooter gap={2} flexWrap="wrap">
              <Button
                ref={cancelRef}
                variant="outline"
                onClick={dialog.onClose}
              >
                Keep appointment
              </Button>
              <Button
                bg="#A83F3F"
                _hover={{ bg: "#8F3434" }}
                isLoading={action.isPending}
                onClick={() =>
                  action.mutate(
                    { id: a.id, action: "cancel" },
                    { onSuccess: dialog.onClose },
                  )
                }
              >
                Cancel appointment
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
