import {
  Box,
  Button,
  Container,
  Flex,
  HStack,
  Icon,
  Select,
  Text,
  VStack,
  Link as ChakraLink,
} from "@chakra-ui/react";
import {
  Home,
  CalendarPlus,
  CalendarDays,
  UserRound,
  ArrowUpRight,
  Leaf,
} from "lucide-react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Brand, ErrorState, LoadingSkeleton } from "../components/Common";
import { useClient } from "../features/clients/ClientContext";
const navigation = [
  { to: "/", label: "Home", icon: Home },
  { to: "/book", label: "Book", icon: CalendarPlus },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/profile", label: "Profile", icon: UserRound },
];
export function AppLayout() {
  const { clients, client, selectClient, loading, error, retry } = useClient(),
    location = useLocation(),
    reduced = useReducedMotion();
  const doctor = location.pathname.startsWith("/nutritionist");
  return (
    <Box minH="100dvh">
      <ChakraLink
        href="#main"
        position="fixed"
        top="-100px"
        _focus={{ top: 2, left: 2, zIndex: 100, bg: "white", p: 3 }}
      >
        Skip to content
      </ChakraLink>
      <Box as="header" bg="ivory" borderBottom="1px solid #E5EAE3">
        <Container maxW="1200px" px={{ base: 5, md: 8 }}>
          <Flex minH="90px" align="center" justify="space-between" gap={3}>
            <Link to="/" aria-label="Nourish home">
              <Brand />
            </Link>
            <HStack
              as="nav"
              aria-label="Primary"
              display={{ base: "none", lg: "flex" }}
              spacing={2}
            >
              {navigation.slice(0, 3).map((n) => (
                <Button
                  key={n.to}
                  as={NavLink}
                  end={n.to === "/"}
                  to={n.to}
                  variant="ghost"
                  fontSize="sm"
                  px={5}
                  _activeLink={{ bg: "brand.100", color: "brand.700" }}
                >
                  {n.label === "Book" ? "Book a consultation" : n.label}
                </Button>
              ))}
            </HStack>
            <HStack spacing={{ base: 2, md: 4 }}>
              <Button
                as={Link}
                to={doctor ? "/" : "/nutritionist"}
                variant="ghost"
                size="sm"
                fontSize="xs"
                rightIcon={<ArrowUpRight size={14} />}
                display={{ base: "none", md: "inline-flex" }}
              >
                {doctor ? "Client experience" : "For nutritionists"}
              </Button>
              <Link
                to="/profile"
                aria-label={`Client profile ${
                  client?.full_name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("") || ""
                }`}
              >
                <Flex
                  aria-hidden="true"
                  w={10}
                  h={10}
                  rounded="full"
                  align="center"
                  justify="center"
                  bg="peach"
                  fontWeight="600"
                  color="brand.700"
                >
                  {client?.full_name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("") || <UserRound size={18} />}
                </Flex>
              </Link>
            </HStack>
          </Flex>
        </Container>
      </Box>
      <Container maxW="1200px" px={{ base: 5, md: 8 }}>
        <Flex
          py={4}
          gap={3}
          align={{ base: "start", sm: "center" }}
          justify="space-between"
          direction={{ base: "column", sm: "row" }}
        >
          <HStack spacing={2}>
            <Box w="6px" h="6px" bg="brand.500" rounded="full" />
            <Text fontSize="xs" color="muted">
              A little care, a healthier you.
            </Text>
          </HStack>
          <HStack maxW="100%">
            <Text fontSize="xs" color="muted" whiteSpace="nowrap">
              Demo client
            </Text>
            <Select
              aria-label="Demo client"
              value={client?.id || ""}
              onChange={(e) => selectClient(e.target.value)}
              size="sm"
              maxW="190px"
              minH="40px"
              rounded="full"
              borderColor="brand.200"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </Select>
          </HStack>
        </Flex>
        <Box
          as="main"
          id="main"
          pt={{ base: 5, md: 7 }}
          pb={{ base: 32, lg: 12 }}
        >
          <motion.div
            key={`${location.pathname}${location.search}`}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {loading ? (
              <LoadingSkeleton />
            ) : error ? (
              <ErrorState error={error} retry={retry} />
            ) : (
              <Outlet />
            )}
          </motion.div>
        </Box>
        <Flex
          as="footer"
          display={{ base: "none", lg: "flex" }}
          borderTop="1px solid #E5EAE3"
          py={6}
          justify="space-between"
          gap={4}
        >
          <HStack>
            <Leaf size={15} color="#557C68" />
            <Text fontSize="xs" color="muted">
              Thoughtfully made for your wellbeing.
            </Text>
          </HStack>
          <Text fontSize="xs" color="muted">
            Public demo · Fictional clients only
          </Text>
        </Flex>
      </Container>
      <Flex
        as="nav"
        aria-label="Mobile navigation"
        display={{ base: "flex", lg: "none" }}
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        bg="white"
        borderTop="1px solid #E5EAE3"
        pt={2}
        pb="max(8px, env(safe-area-inset-bottom))"
        zIndex={20}
        justify="space-around"
      >
        {navigation.map((n) => (
          <VStack
            as={NavLink}
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            spacing={1}
            flex={1}
            py={2}
            color="muted"
            _activeLink={{ color: "brand.700", bg: "brand.50" }}
            rounded="xl"
            minH="56px"
            fontSize="10px"
          >
            <Icon as={n.icon} boxSize={5} />
            <Text>{n.label}</Text>
          </VStack>
        ))}
      </Flex>
    </Box>
  );
}
