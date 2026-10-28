import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { Client, PracticeConfig } from "../../types";
interface Context {
  clients: Client[];
  client: Client | undefined;
  selectClient: (id: string) => void;
  config: PracticeConfig | undefined;
  loading: boolean;
  error: Error | null;
  retry: () => void;
}
const ClientContext = createContext<Context>(null!);
export function ClientProvider({ children }: { children: ReactNode }) {
  const clients = useQuery({ queryKey: ["clients"], queryFn: api.clients });
  const config = useQuery({
    queryKey: ["config"],
    queryFn: api.config,
    refetchInterval: 30000,
  });
  const [id, setId] = useState(() => {
    try {
      return localStorage.getItem("nourish-client") || "";
    } catch {
      return "";
    }
  });
  const client = clients.data?.find((c) => c.id === id) || clients.data?.[0];
  const selectClient = (value: string) => {
    setId(value);
    try {
      localStorage.setItem("nourish-client", value);
    } catch {
      /* Selection remains available for this session. */
    }
  };
  useEffect(() => {
    if (client && !id) selectClient(client.id);
  }, [client, id]);
  return (
    <ClientContext.Provider
      value={{
        clients: clients.data || [],
        client,
        selectClient,
        config: config.data,
        loading: clients.isPending || config.isPending,
        error: clients.error || config.error,
        retry: () => {
          void clients.refetch();
          void config.refetch();
        },
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}
export const useClient = () => useContext(ClientContext);
