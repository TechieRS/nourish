import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { detailsSchema, type Details } from "../features/booking/validation";
import { useClient } from "../features/clients/ClientContext";
import { api } from "../services/api";
import { PageHeading, panel } from "../components/Common";
export function ProfilePage() {
  const { client, selectClient, config } = useClient(),
    [adding, setAdding] = useState(false),
    qc = useQueryClient(),
    toast = useToast(),
    form = useForm<Details>({ resolver: zodResolver(detailsSchema) });
  const create = useMutation({
    mutationFn: (d: Details) =>
      api.createClient({ full_name: d.full_name, phone: d.phone || null }),
    onSuccess: async (c) => {
      await qc.invalidateQueries({ queryKey: ["clients"] });
      selectClient(c.id);
      setAdding(false);
      form.reset();
      toast({ title: "Your demo profile is ready.", status: "success" });
    },
    onError: (e: Error) => toast({ title: e.message, status: "error" }),
  });
  return (
    <>
      <PageHeading
        eyebrow="Your space"
        title="Your wellness profile"
        description="A little introduction. A more personal experience."
      />
      <Stack maxW="650px" spacing={5}>
        <Box {...panel}>
          <Flex
            w={16}
            h={16}
            bg="peach"
            rounded="full"
            align="center"
            justify="center"
            mb={5}
          >
            <UserRound color="#557C68" size={27} />
          </Flex>
          <Heading size="lg" mb={2}>
            {client?.full_name || "Welcome to Nourish"}
          </Heading>
          <Text color="muted" fontSize="sm">
            {client?.phone || "No phone number provided"}
          </Text>
          <Text fontSize="xs" color="muted" mt={5}>
            Practice timezone: {config?.timezone}
          </Text>
        </Box>
        <Box {...panel}>
          <Heading fontSize="lg" mb={3}>
            A thoughtful demo
          </Heading>
          <Text fontSize="sm" color="muted" lineHeight="1.8" mb={5}>
            The client selector lets you explore fictional profiles without
            logging in. It is a demo identity mechanism, not authentication.
            Anyone with access can view and change demo records. Please use
            fictional details only.
          </Text>
          <Button
            variant="outline"
            leftIcon={<Plus size={16} />}
            onClick={() => setAdding(!adding)}
          >
            {adding ? "Close form" : "Create demo client"}
          </Button>
          {adding && (
            <Stack
              as="form"
              mt={6}
              spacing={4}
              onSubmit={form.handleSubmit((d) => create.mutate(d))}
            >
              <FormControl isInvalid={!!form.formState.errors.full_name}>
                <FormLabel htmlFor="profile-name">Full name</FormLabel>
                <Input id="profile-name" {...form.register("full_name")} />
                <FormErrorMessage>
                  {form.formState.errors.full_name?.message}
                </FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!form.formState.errors.phone}>
                <FormLabel htmlFor="profile-phone">Phone (optional)</FormLabel>
                <Input
                  id="profile-phone"
                  type="tel"
                  {...form.register("phone")}
                />
                <FormErrorMessage>
                  {form.formState.errors.phone?.message}
                </FormErrorMessage>
              </FormControl>
              <Button type="submit" isLoading={create.isPending}>
                Create profile
              </Button>
            </Stack>
          )}
        </Box>
        <Button
          as={Link}
          to="/nutritionist"
          rightIcon={<ArrowUpRight size={17} />}
        >
          Open nutritionist dashboard
        </Button>
        <Text color="muted" fontSize="xs" lineHeight="1.8">
          Reminders are shown in the app. SMS, WhatsApp, email, and push
          delivery are not integrated. Online consultations are appointment
          records; video calls are arranged outside this demo.
        </Text>
      </Stack>
    </>
  );
}
