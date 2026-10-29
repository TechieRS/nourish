import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Skeleton,
  Stack,
  Text,
  Badge,
} from "@chakra-ui/react";
import { Leaf, RefreshCw, CalendarPlus, Check, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import type { Status } from "../types";
export function Brand() {
  return (
    <HStack spacing={2}>
      <Flex
        bg="brand.700"
        color="white"
        w="36px"
        h="36px"
        rounded="full"
        align="center"
        justify="center"
      >
        <Leaf size={20} />
      </Flex>
      <Text
        fontFamily="heading"
        fontSize="29px"
        fontWeight="600"
        letterSpacing="-1.5px"
      >
        nourish
        <Text as="span" color="brand.600">
          .
        </Text>
      </Text>
    </HStack>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge
      px={3}
      py={1}
      rounded="full"
      textTransform="none"
      fontWeight="500"
      colorScheme={
        status === "Booked" ? "blue" : status === "Done" ? "green" : "red"
      }
    >
      {status}
    </Badge>
  );
}
export function AttendanceBadge({ confirmed }: { confirmed: boolean }) {
  return (
    <HStack
      spacing={1}
      fontSize="xs"
      color={confirmed ? "brand.700" : "#806222"}
    >
      <Icon as={confirmed ? Check : Clock} boxSize={3.5} />
      <Text>{confirmed ? "Confirmed" : "Awaiting confirmation"}</Text>
    </HStack>
  );
}
export function EmptyState({
  title = "Your next step toward better wellness starts here.",
  description = "Make a little time for yourself. We’ll take care of the rest.",
  booking = true,
}: {
  title?: string;
  description?: string;
  booking?: boolean;
}) {
  return (
    <Stack align="center" textAlign="center" py={12} px={5} spacing={4}>
      <Flex
        rounded="full"
        w={16}
        h={16}
        bg="brand.100"
        align="center"
        justify="center"
      >
        <CalendarPlus color="#557C68" size={28} />
      </Flex>
      <Heading fontSize="xl" maxW="340px">
        {title}
      </Heading>
      <Text color="muted" fontSize="sm" maxW="340px">
        {description}
      </Text>
      {booking && (
        <Button as={Link} to="/book" rightIcon={<CalendarPlus size={17} />}>
          Book a consultation
        </Button>
      )}
    </Stack>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <Box role="alert" bg="peach" rounded="2xl" p={6}>
      <Heading size="sm" mb={2}>
        Let’s try that again
      </Heading>
      <Text mb={4}>{error.message}</Text>
      <Button
        onClick={retry}
        leftIcon={<RefreshCw size={16} />}
        variant="outline"
      >
        Try again
      </Button>
    </Box>
  );
}
export function LoadingSkeleton() {
  return (
    <Stack
      spacing={5}
      role="status"
      aria-label="Loading appointments"
      aria-busy="true"
    >
      <Skeleton h="30px" w="50%" rounded="lg" />
      <Skeleton h="180px" rounded="2xl" />
      <Skeleton h="180px" rounded="2xl" />
    </Stack>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Flex
      gap={4}
      justify="space-between"
      align={{ base: "start", md: "center" }}
      direction={{ base: "column", md: "row" }}
      mb={8}
    >
      <Box>
        <Text
          fontSize="xs"
          fontWeight="600"
          letterSpacing="2px"
          textTransform="uppercase"
          color="brand.600"
          mb={3}
        >
          {eyebrow}
        </Text>
        <Heading as="h1" fontSize={{ base: "30px", md: "38px" }} mb={2}>
          {title}
        </Heading>
        <Text color="muted" fontSize={{ base: "sm", md: "md" }}>
          {description}
        </Text>
      </Box>
      {action}
    </Flex>
  );
}
export const panel = {
  bg: "white",
  border: "1px solid",
  borderColor: "#E5EAE3",
  rounded: "2xl",
  p: { base: 5, md: 7 },
} as const;
