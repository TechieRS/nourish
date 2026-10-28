import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@chakra-ui/react";
import { api } from "../services/api";
import type { Status } from "../types";
export function useAppointments(clientId?: string, all = false) {
  return useQuery({
    queryKey: ["appointments", all ? "all" : clientId],
    queryFn: () => api.appointments(all ? "" : `?client_id=${clientId}`),
    enabled: all || !!clientId,
    refetchInterval: 15000,
  });
}
export function useAppointmentAction() {
  const qc = useQueryClient(),
    toast = useToast();
  return useMutation({
    mutationFn: ({
      id,
      action,
      status,
    }: {
      id: string;
      action: "confirm" | "cancel" | "status";
      status?: Status;
    }) => (action === "status" ? api.status(id, status!) : api[action](id)),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      void qc.invalidateQueries({ queryKey: ["summary"] });
      void qc.invalidateQueries({ queryKey: ["availability"] });
      toast({
        title:
          v.action === "confirm"
            ? "You’re confirmed. We look forward to seeing you!"
            : v.action === "cancel"
              ? "Appointment cancelled. Your slot has been released."
              : "Appointment status updated.",
        status: "success",
        duration: 4000,
        isClosable: true,
      });
    },
    onError: (error: Error) =>
      toast({
        title: error.message,
        status: "error",
        duration: 6000,
        isClosable: true,
      }),
  });
}
