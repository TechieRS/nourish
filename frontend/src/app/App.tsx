import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import { Box, Button, Heading, Text } from "@chakra-ui/react";
import { ClientProvider } from "../features/clients/ClientContext";
import { AppLayout } from "../layouts/AppLayout";
import { HomePage } from "../pages/HomePage";
import { BookingPage } from "../pages/BookingPage";
import { AppointmentsPage } from "../pages/AppointmentsPage";
import { ProfilePage } from "../pages/ProfilePage";
import { DashboardPage } from "../pages/DashboardPage";
export function App() {
  return (
    <BrowserRouter>
      <ClientProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="book" element={<BookingPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="nutritionist" element={<DashboardPage />} />
            <Route
              path="*"
              element={
                <Box py={12} textAlign="center">
                  <Heading mb={4}>Let’s find your way back.</Heading>
                  <Text mb={5}>
                    This page isn’t part of your wellness journey.
                  </Text>
                  <Button as={Link} to="/">
                    Return home
                  </Button>
                </Box>
              }
            />
          </Route>
        </Routes>
      </ClientProvider>
    </BrowserRouter>
  );
}
