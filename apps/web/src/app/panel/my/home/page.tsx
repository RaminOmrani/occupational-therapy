"use client";
import { Dumbbell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner } from "@/components/ui";
import { RecordsPanel } from "@/components/patient/RecordsPanel";
export default function Page() {
  const { user } = useAuth();
  if (!user?.patientId) return <Spinner />;
  return <><PageHeader title="تمرین‌های خانگی" subtitle="هر روز پس از انجام تمرین، دکمه «انجام دادم» را بزنید تا درمانگر روند شما را ببیند" icon={<Dumbbell className="h-5 w-5" />} /><RecordsPanel patientId={user.patientId} initialTab="home" /></>;
}
