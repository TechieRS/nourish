import {
  Box,
  Button,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from "@chakra-ui/react";
import { CalendarPlus } from "lucide-react";
import { Link } from "react-router-dom";
import {
  PageHeading,
  EmptyState,
  LoadingSkeleton,
  ErrorState,
} from "../components/Common";
import { AppointmentCard } from "../components/AppointmentCard";
import { useAppointments } from "../hooks/useAppointments";
import { useClient } from "../features/clients/ClientContext";
import { isFuture } from "../utils/dates";
export function AppointmentsPage() {
  const { client, config } = useClient(),
    query = useAppointments(client?.id);
  if (!config) return null;
  const future = (query.data || []).filter((a) => isFuture(a, config)),
    past = (query.data || []).filter((a) => !isFuture(a, config)).reverse();
  return (
    <>
      <PageHeading
        eyebrow="A little time for you"
        title="Your consultations"
        description="Every conversation is a step forward."
        action={
          <Button as={Link} to="/book" leftIcon={<CalendarPlus size={17} />}>
            Book consultation
          </Button>
        }
      />
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <Tabs isLazy>
          <TabList borderColor="brand.200" mb={6}>
            <Tab minH="48px" fontSize="sm">
              Upcoming ({future.length})
            </Tab>
            <Tab minH="48px" fontSize="sm">
              Past ({past.length})
            </Tab>
          </TabList>
          <TabPanels>
            {[future, past].map((list, i) => (
              <TabPanel p={0} key={i}>
                <Box maxW="760px">
                  <Stack spacing={4}>
                    {list.map((a) => (
                      <AppointmentCard
                        key={a.id}
                        appointment={a}
                        featured={i === 0}
                      />
                    ))}
                  </Stack>
                  {!list.length && (
                    <EmptyState
                      title={
                        i === 0
                          ? undefined
                          : "Your consultation history will appear here."
                      }
                      description={
                        i === 0
                          ? undefined
                          : "A record of the care you’ve made time for."
                      }
                      booking={i === 0}
                    />
                  )}
                </Box>
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      )}
    </>
  );
}
