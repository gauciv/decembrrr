import { useAuth } from "@/context/auth";
import PresidentHomeTab from "@/components/president/home-tab";
import StudentHomeTab from "@/components/student/home-tab";

export default function DashboardPage() {
  const { profile } = useAuth();
  if (!profile) return null;

  return profile.is_president ? <PresidentHomeTab /> : <StudentHomeTab />;
}
