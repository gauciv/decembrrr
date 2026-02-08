import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/auth";
import AppLayout from "@/layouts/app-layout";
import LoginPage from "@/pages/login";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import PaymentsPage from "@/pages/payments";
import FundPage from "@/pages/fund";
import CalendarPage from "@/pages/calendar-page";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🎄</div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  if (!profile?.class_id) return <OnboardingPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/fund" element={<FundPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
