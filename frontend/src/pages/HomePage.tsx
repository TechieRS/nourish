import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  Heart,
  Leaf,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useClient } from "../features/clients/ClientContext";
import { useAppointments } from "../hooks/useAppointments";
import { AppointmentCard } from "../components/AppointmentCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  panel,
} from "../components/Common";
import { dayLabel, isFuture, timeLabel } from "../utils/dates";
function BotanicalArt() {
  return (
    <Box
      aria-hidden="true"
      position="absolute"
      right={{ base: "-55px", md: "-25px" }}
      bottom="-50px"
      w={{ base: "210px", md: "330px" }}
      opacity={{ base: 0.28, md: 0.65 }}
    >
      <svg viewBox="0 0 320 390" fill="none">
        <circle cx="180" cy="190" r="125" fill="#426451" />
        <path
          d="M155 385C170 250 140 155 218 38M169 278C122 224 81 217 56 192M174 222C208 178 239 164 282 152M172 152C140 108 118 95 89 86"
          stroke="#ACC5AA"
          strokeWidth="3"
        />
        <path
          d="M173 279C109 280 63 244 56 192C109 186 154 224 173 279Z"
          fill="#7C9F77"
        />
        <path
          d="M174 223C178 161 231 132 282 152C268 203 222 232 174 223Z"
          fill="#B7C9A3"
        />
        <path
          d="M172 153C116 153 83 124 89 86C136 78 173 111 172 153Z"
          fill="#9FB992"
        />
        <path
          d="M184 113C169 69 185 31 226 15C245 55 230 95 184 113Z"
          fill="#D4DCB8"
        />
      </svg>
    </Box>
  );
}
export function HomePage() {
  const { client, config } = useClient(),
    query = useAppointments(client?.id);
  if (!config) return null;
  const upcoming = (query.data || []).filter(
      (a) => isFuture(a, config) && a.status === "Booked",
    ),
    next = upcoming[0];
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: config.timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const days = next
    ? differenceInCalendarDays(
        parseISO(next.appointment_date),
        parseISO(config.today),
      )
    : null;
  return (
    <>
      <Flex justify="space-between" align="center" gap={4} mb={7}>
        <Box>
          <Text
            fontSize="xs"
            textTransform="uppercase"
            letterSpacing="2px"
            color="brand.600"
            mb={3}
          >
            {dayLabel(config.today, "EEEE, MMMM d")}
          </Text>
          <Heading as="h1" fontSize={{ base: "29px", md: "38px" }}>
            {greeting}, {client?.full_name.split(" ")[0] || "friend"}{" "}
            <Text as="span" fontSize="25px">
              🌿
            </Text>
          </Heading>
          <Text color="muted" fontSize="sm" mt={2}>
            A little space for you and your wellbeing.
          </Text>
        </Box>
        <Flex
          display={{ base: "none", md: "flex" }}
          w={12}
          h={12}
          rounded="full"
          bg="brand.100"
          align="center"
          justify="center"
        >
          <Sparkles color="#557C68" size={21} />
        </Flex>
      </Flex>
      <Box
        position="relative"
        overflow="hidden"
        rounded="3xl"
        bg="brand.700"
        color="white"
        p={{ base: 7, md: 10 }}
        mb={9}
        minH={{ base: "265px", md: "285px" }}
      >
        <BotanicalArt />
        <Box position="relative" maxW={{ base: "100%", md: "65%" }} zIndex={1}>
          <HStack spacing={2} mb={5}>
            <Box w="5px" h="5px" rounded="full" bg="#CEDBB7" />
            <Text
              color="#D6E3D5"
              fontSize="10px"
              letterSpacing="2px"
              fontWeight="600"
            >
              YOUR WELLNESS, ONE STEP AT A TIME
            </Text>
          </HStack>
          <Heading
            fontSize={{ base: "31px", md: "45px" }}
            lineHeight="1.13"
            fontWeight="500"
            mb={4}
          >
            Small steps.
            <br />A healthier, happier you.
          </Heading>
          <Text
            color="#D6E3D5"
            fontSize="sm"
            lineHeight="1.8"
            maxW="365px"
            mb={6}
          >
            Feel supported with nutrition care that fits your life. Your next
            chapter starts with a conversation.
          </Text>
          <Button
            as={Link}
            to="/book"
            bg="#E6EFE8"
            color="brand.700"
            _hover={{ bg: "white" }}
            rightIcon={<ArrowUpRight size={18} />}
            size="md"
          >
            Book a consultation
          </Button>
        </Box>
      </Box>
      <Grid templateColumns={{ base: "1fr", lg: "1.65fr 1fr" }} gap={7}>
        <Box>
          <Flex justify="space-between" align="center" mb={5}>
            <HStack>
              <Heading fontSize="22px">Your next consultation</Heading>
              {upcoming.length > 0 && (
                <Flex
                  rounded="full"
                  bg="brand.100"
                  px={2}
                  fontSize="xs"
                  fontWeight="600"
                >
                  {upcoming.length}
                </Flex>
              )}
            </HStack>
            <Button
              as={Link}
              to="/appointments"
              variant="ghost"
              size="sm"
              rightIcon={<ArrowRight size={14} />}
            >
              View all
            </Button>
          </Flex>
          {query.isPending ? (
            <LoadingSkeleton />
          ) : query.error ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : next ? (
            <>
              <Box bg="peach" rounded="xl" px={4} py={3} mb={4}>
                <HStack>
                  <CalendarPlus size={16} />
                  <Text fontSize="xs">
                    {days === 0
                      ? "A little reminder: your consultation is today"
                      : days === 1
                        ? "Your consultation is tomorrow"
                        : `Your next consultation is in ${days} days`}{" "}
                    at {timeLabel(next.start_time)}.
                  </Text>
                </HStack>
              </Box>
              <AppointmentCard appointment={next} featured />
              {upcoming[1] && (
                <Box mt={4}>
                  <AppointmentCard appointment={upcoming[1]} />
                </Box>
              )}
            </>
          ) : (
            <Box {...panel}>
              <EmptyState />
            </Box>
          )}
        </Box>
        <Stack spacing={5}>
          <Box {...panel}>
            <HStack mb={4} justify="space-between">
              <Flex
                rounded="full"
                bg="peach"
                w={10}
                h={10}
                align="center"
                justify="center"
              >
                <Heart size={18} color="#775D4B" />
              </Flex>
              <Text fontSize="10px" letterSpacing="1.5px" color="muted">
                A GENTLE REMINDER
              </Text>
            </HStack>
            <Heading fontSize="23px" lineHeight="1.35" mb={3}>
              Progress is personal.
              <br />
              Your pace is enough.
            </Heading>
            <Text color="muted" fontSize="sm" lineHeight="1.8">
              Wellness isn’t a finish line. It’s the small, kind choices you
              make for yourself every day.
            </Text>
            <HStack mt={5} color="brand.600">
              <Leaf size={14} />
              <Text fontSize="xs">The Nourish philosophy</Text>
            </HStack>
          </Box>
          <Box bg="brand.100" rounded="2xl" p={6}>
            <HStack align="start" spacing={3}>
              <CheckCircle2 size={22} color="#426451" />
              <Box>
                <Heading fontSize="md" mb={2}>
                  Care that feels connected
                </Heading>
                <Text fontSize="xs" color="muted" lineHeight="1.8">
                  Book, confirm, and manage your consultations. A calmer routine
                  starts here.
                </Text>
                <Button
                  as={Link}
                  to="/profile"
                  variant="link"
                  fontSize="xs"
                  mt={3}
                  rightIcon={<ArrowRight size={13} />}
                >
                  Your wellness profile
                </Button>
              </Box>
            </HStack>
          </Box>
        </Stack>
      </Grid>
      <SimpleGrid
        columns={{ base: 1, md: 3 }}
        spacing={5}
        mt={9}
        pt={7}
        borderTop="1px solid #E5EAE3"
      >
        {[
          {
            icon: Leaf,
            title: "Personal, always",
            text: "Nutrition care built around your life.",
          },
          {
            icon: CalendarPlus,
            title: "On your terms",
            text: "Easy booking. Room for life to change.",
          },
          {
            icon: Heart,
            title: "A little more supported",
            text: "One thoughtful conversation at a time.",
          },
        ].map((x) => (
          <HStack key={x.title} spacing={3}>
            <Flex
              bg="white"
              rounded="full"
              minW={10}
              h={10}
              align="center"
              justify="center"
            >
              <x.icon size={17} color="#557C68" />
            </Flex>
            <Box>
              <Text fontWeight="600" fontSize="xs">
                {x.title}
              </Text>
              <Text color="muted" fontSize="xs" mt={1}>
                {x.text}
              </Text>
            </Box>
          </HStack>
        ))}
      </SimpleGrid>
    </>
  );
}
