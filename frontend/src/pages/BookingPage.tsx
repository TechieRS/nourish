import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  Heading,
  HStack,
  Input,
  Select,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Leaf,
  ShieldCheck,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useClient } from "../features/clients/ClientContext";
import { detailsSchema, type Details } from "../features/booking/validation";
import { api, ApiError } from "../services/api";
import { DatePicker } from "../components/DatePicker";
import { TimeSlotPicker } from "../components/TimeSlotPicker";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeading,
  panel,
} from "../components/Common";
import {
  dayLabel,
  downloadCalendar,
  isFuture,
  timeLabel,
} from "../utils/dates";
import type { Appointment, Status } from "../types";
export function BookingPage() {
  const { clients, client, config, selectClient } = useClient(),
    [params] = useSearchParams(),
    rescheduleId = params.get("reschedule"),
    manual = params.get("mode") === "nutritionist",
    qc = useQueryClient(),
    toast = useToast();
  const [step, setStep] = useState(0),
    [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [newClient, setNewClient] = useState(false),
    [target, setTarget] = useState(client?.id || ""),
    [status, setStatus] = useState<Status>("Booked"),
    [saved, setSaved] = useState<Appointment | null>(null);
  const original = useQuery({
    queryKey: ["appointment", rescheduleId],
    queryFn: () => api.appointment(rescheduleId!),
    enabled: !!rescheduleId,
  });
  const selected = clients.find((c) => c.id === target) || client;
  const form = useForm<Details>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      full_name: client?.full_name || "",
      phone: client?.phone || "",
    },
  });
  useEffect(() => {
    if (!newClient) {
      setTarget(client?.id || "");
      form.reset({
        full_name: client?.full_name || "",
        phone: client?.phone || "",
      });
    }
  }, [client?.id]);
  const setSelected = (id: string) => {
    setTarget(id);
    const c = clients.find((c) => c.id === id);
    form.reset({ full_name: c?.full_name || "", phone: c?.phone || "" });
  };
  const mutation = useMutation({
    mutationFn: async (details: Details) => {
      if (rescheduleId)
        return api.reschedule(rescheduleId, {
          appointment_date: date,
          start_time: time,
        });
      let clientId = selected?.id;
      if (newClient) {
        const created = await api.createClient({
          full_name: details.full_name,
          phone: details.phone || null,
        });
        clientId = created.id;
        setTarget(created.id);
        setNewClient(false);
        selectClient(created.id);
        await qc.invalidateQueries({ queryKey: ["clients"] });
      }
      if (!clientId) throw new Error("Please select or create a demo client.");
      return api.book({
        client_id: clientId,
        appointment_date: date,
        start_time: time,
        status: manual ? status : "Booked",
      });
    },
    onSuccess: (a) => {
      setSaved(a);
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      void qc.invalidateQueries({ queryKey: ["appointment"] });
      void qc.invalidateQueries({ queryKey: ["summary"] });
      void qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (e: Error) => {
      if (e instanceof ApiError && (e.status === 409 || e.status === 422)) {
        setTime("");
        setStep(1);
        void qc.invalidateQueries({ queryKey: ["availability"] });
      }
      toast({
        title: e.message,
        status: "error",
        isClosable: true,
        duration: 6500,
      });
    },
  });
  if (!config) return null;
  if (rescheduleId && original.isPending) return <LoadingSkeleton />;
  if (rescheduleId && original.error)
    return (
      <ErrorState
        error={original.error}
        retry={() => void original.refetch()}
      />
    );
  if (
    original.data &&
    (!isFuture(original.data, config) ||
      original.data.status !== "Booked" ||
      original.data.cancelled_at)
  )
    return (
      <EmptyState
        title="This consultation can no longer be rescheduled."
        description="You can still book a new consultation."
      />
    );
  if (saved)
    return (
      <Box maxW="620px" mx="auto" {...panel} textAlign="center" py={12}>
        <Flex
          w={20}
          h={20}
          rounded="full"
          bg="brand.100"
          color="brand.600"
          align="center"
          justify="center"
          mx="auto"
          mb={6}
        >
          <CheckCircle2 size={40} />
        </Flex>
        <Text fontSize="xs" color="brand.600" letterSpacing="2px" mb={3}>
          A LITTLE TIME, JUST FOR YOU
        </Text>
        <Heading as="h1" fontSize="32px">
          {rescheduleId
            ? "Your new time is saved."
            : "You’re booked, beautifully."}
        </Heading>
        <Text color="muted" fontSize="sm" mt={3} mb={7}>
          We look forward to supporting your wellness journey,{" "}
          {saved.client.full_name.split(" ")[0]}.
        </Text>
        <Box bg="brand.50" rounded="2xl" p={6} textAlign="left">
          <Text fontWeight="600" mb={4}>
            Nutrition consultation
          </Text>
          <Stack spacing={3} fontSize="sm">
            <HStack>
              <CalendarDays size={17} />
              <Text>{dayLabel(saved.appointment_date)}</Text>
            </HStack>
            <HStack>
              <Clock size={17} />
              <Text>
                {timeLabel(saved.start_time)} · 30 min · {config.timezone}
              </Text>
            </HStack>
          </Stack>
          <Text fontSize="xs" color="muted" mt={5}>
            Booking reference: {saved.id}
          </Text>
          <Text fontSize="xs" color="muted" mt={2}>
            Your booking is saved. Please confirm attendance from your
            appointments page.
          </Text>
        </Box>
        <Stack mt={6} spacing={3}>
          <Button
            variant="outline"
            onClick={() => downloadCalendar(saved, config.timezone)}
            leftIcon={<Download size={16} />}
          >
            Add to calendar
          </Button>
          <Button
            as={Link}
            to={manual ? "/nutritionist" : "/"}
            rightIcon={<ArrowRight size={17} />}
          >
            {manual ? "Return to dashboard" : "Return home"}
          </Button>
        </Stack>
      </Box>
    );
  return (
    <>
      <PageHeading
        eyebrow={
          rescheduleId
            ? "Room for life to change"
            : "Your next step starts here"
        }
        title={
          rescheduleId
            ? "Find a new time"
            : manual
              ? "Add a consultation"
              : "Make time for your wellbeing"
        }
        description={
          rescheduleId
            ? "Your original time stays reserved until this change is saved."
            : "A thoughtful conversation. A plan that feels like you."
        }
      />
      <Grid
        templateColumns={{ base: "1fr", lg: "1.55fr 1fr" }}
        gap={7}
        alignItems="start"
      >
        <Box {...panel}>
          <HStack spacing={{ base: 2, md: 5 }} mb={8}>
            {["Choose date", "Select time", "Your details"].map((s, i) => (
              <HStack key={s} flex={1} spacing={2}>
                <Flex
                  minW={7}
                  h={7}
                  rounded="full"
                  align="center"
                  justify="center"
                  bg={i <= step ? "brand.700" : "brand.50"}
                  color={i <= step ? "white" : "muted"}
                  fontSize="xs"
                >
                  {i < step ? <Check size={13} /> : i + 1}
                </Flex>
                <Text
                  fontSize="xs"
                  color={i === step ? "ink" : "muted"}
                  fontWeight={i === step ? 600 : 400}
                >
                  {s}
                </Text>
              </HStack>
            ))}
          </HStack>
          {step === 0 && (
            <>
              <Heading fontSize="23px" mb={2}>
                A day that works for you
              </Heading>
              <Text color="muted" fontSize="sm" mb={6}>
                Start with a little space in your calendar.
              </Text>
              <DatePicker
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setTime("");
                }}
                today={config.today}
                horizon={config.horizon_days}
              />
            </>
          )}
          {step === 1 && (
            <>
              <Heading fontSize="23px" mb={5}>
                Your moment of care
              </Heading>
              <TimeSlotPicker date={date} value={time} onChange={setTime} />
            </>
          )}
          {step === 2 && (
            <Box
              as="form"
              id="booking-details"
              onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
            >
              <Heading fontSize="23px" mb={2}>
                {rescheduleId
                  ? "Ready for a fresh start?"
                  : "A little about you"}
              </Heading>
              <Text color="muted" fontSize="sm" mb={6}>
                {rescheduleId
                  ? "Review your new consultation time."
                  : "Use fictional information for this public demo."}
              </Text>
              {rescheduleId ? (
                <Text fontSize="sm">
                  Rescheduling for {original.data?.client.full_name}.
                </Text>
              ) : (
                <Stack spacing={5}>
                  <FormControl>
                    <FormLabel>Book for</FormLabel>
                    <Select
                      aria-label="Book for"
                      value={newClient ? "new" : target}
                      onChange={(e) => {
                        if (e.target.value === "new") {
                          setNewClient(true);
                          form.reset({ full_name: "", phone: "" });
                        } else {
                          setNewClient(false);
                          setSelected(e.target.value);
                        }
                      }}
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                      ))}
                      <option value="new">+ Add a new demo client</option>
                    </Select>
                  </FormControl>
                  <FormControl isInvalid={!!form.formState.errors.full_name}>
                    <FormLabel htmlFor="full_name">Full name</FormLabel>
                    <Input
                      id="full_name"
                      autoComplete="name"
                      isReadOnly={!newClient}
                      {...form.register("full_name")}
                    />
                    <FormErrorMessage>
                      {form.formState.errors.full_name?.message}
                    </FormErrorMessage>
                  </FormControl>
                  <FormControl isInvalid={!!form.formState.errors.phone}>
                    <FormLabel htmlFor="phone">
                      Phone number{" "}
                      <Text as="span" color="muted" fontWeight="400">
                        (optional)
                      </Text>
                    </FormLabel>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+44 7700 900123"
                      autoComplete="tel"
                      isReadOnly={!newClient}
                      {...form.register("phone")}
                    />
                    <FormErrorMessage>
                      {form.formState.errors.phone?.message}
                    </FormErrorMessage>
                    <Text color="muted" mt={2} fontSize="xs">
                      Include your country code if applicable. No country is
                      assumed.
                    </Text>
                  </FormControl>
                  {manual && (
                    <FormControl>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as Status)}
                      >
                        <option>Booked</option>
                        <option>Done</option>
                        <option>No-show</option>
                      </Select>
                    </FormControl>
                  )}
                </Stack>
              )}
            </Box>
          )}
          <Flex mt={8} justify="space-between" gap={3}>
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft size={16} />}
              isDisabled={mutation.isPending}
              onClick={() => setStep(Math.max(0, step - 1))}
              visibility={step === 0 ? "hidden" : "visible"}
            >
              Back
            </Button>
            {step < 2 ? (
              <Button
                rightIcon={<ArrowRight size={16} />}
                isDisabled={step === 0 ? !date : !time}
                onClick={() => setStep(step + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button
                isLoading={mutation.isPending}
                loadingText="Saving…"
                onClick={
                  rescheduleId
                    ? () => mutation.mutate(form.getValues())
                    : form.handleSubmit((d) => mutation.mutate(d))
                }
                type="button"
                rightIcon={<Check size={17} />}
              >
                {rescheduleId ? "Confirm new time" : "Confirm booking"}
              </Button>
            )}
          </Flex>
        </Box>
        <Stack spacing={5}>
          <Box {...panel}>
            <Flex
              bg="brand.100"
              rounded="xl"
              w={12}
              h={12}
              align="center"
              justify="center"
              mb={5}
            >
              <Leaf size={23} color="#557C68" />
            </Flex>
            <Text fontSize="xs" color="brand.600" letterSpacing="1.5px" mb={3}>
              YOUR CONSULTATION
            </Text>
            <Heading fontSize="24px" mb={2}>
              Nutrition, made personal.
            </Heading>
            <Text color="muted" fontSize="sm" lineHeight="1.8" mb={6}>
              A one-to-one conversation about your goals, your habits, and
              feeling your best.
            </Text>
            <Stack spacing={4} fontSize="sm">
              <HStack>
                <Clock size={17} />
                <Text>30 minutes · Online</Text>
              </HStack>
              <HStack>
                <CalendarDays size={17} />
                <Text>
                  {date ? dayLabel(date, "EEE, MMM d") : "Choose your date"}
                  {time ? ` · ${timeLabel(time)}` : ""}
                </Text>
              </HStack>
            </Stack>
            <Box borderTop="1px solid #E5EAE3" pt={5} mt={5}>
              <Text fontSize="xs" color="muted">
                Practice timezone
              </Text>
              <Text fontSize="sm" mt={1}>
                {config.timezone}
              </Text>
            </Box>
          </Box>
          <HStack px={3} align="start" color="muted" spacing={3}>
            <ShieldCheck size={21} />
            <Text fontSize="xs" lineHeight="1.8">
              Plans change. Reschedule or cancel an upcoming consultation with a
              few simple taps.
            </Text>
          </HStack>
          {rescheduleId && original.data && (
            <Box p={5} rounded="2xl" bg="peach">
              <Text fontSize="xs" fontWeight="600">
                Currently reserved
              </Text>
              <Text fontSize="sm" mt={2}>
                {dayLabel(original.data.appointment_date, "MMM d")} ·{" "}
                {timeLabel(original.data.start_time)}
              </Text>
            </Box>
          )}
        </Stack>
      </Grid>
    </>
  );
}
