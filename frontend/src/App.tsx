import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/auth";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorScreen } from "@/components/error-screen";
import { checkSupabaseConfig } from "@/lib/supabase";
import AppLayout from "@/layouts/app-layout";

const LoginPage = lazy(() => import("@/pages/login"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const PresidentClassPage = lazy(() => import("@/pages/president-class"));
const PresidentAnalyticsPage = lazy(() => import("@/pages/president-analytics"));
const CalendarPage = lazy(() => import("@/pages/calendar-page"));
const StudentTransactionsPage = lazy(() => import("@/pages/student-transactions"));
const StudentClassPage = lazy(() => import("@/pages/student-class"));
const JoinPage = lazy(() => import("@/pages/join"));

const queryClient = new QueryClient();

/**
 * Validates Supabase env vars before rendering the app.
 * Shows a helpful error screen with setup instructions if .env is missing.
 */
function ConfigGuard({ children }: { children: React.ReactNode }) {
  const status = checkSupabaseConfig();
  if (!status.ok) {
    return <ErrorScreen error={status.error} />;
  }
  return <>{children}</>;
}

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

  if (!user) {
    /* Allow /join to render even when not signed in — it will redirect to login */
    return (
      <Suspense>
        <Routes>
          <Route path="/join" element={<JoinPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </Suspense>
    );
  }

  /* /join route is accessible before the student has a class */
  if (!profile?.class_id) {
    return (
      <Suspense>
        <Routes>
          <Route path="/join" element={<JoinPage />} />
          <Route path="*" element={<OnboardingPage />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          {/* President routes */}
          <Route path="/class-list" element={<PresidentClassPage />} />
          <Route path="/analytics" element={<PresidentAnalyticsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          {/* Student routes */}
          <Route path="/transactions" element={<StudentTransactionsPage />} />
          <Route path="/class" element={<StudentClassPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ConfigGuard>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </ConfigGuard>
    </ErrorBoundary>
  );
}
