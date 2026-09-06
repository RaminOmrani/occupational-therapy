"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FolderHeart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner } from "@/components/ui";
import { RecordsPanel } from "@/components/patient/RecordsPanel";
function Inner() {
  const { user } = useAuth();
  const sp = useSearchParams();
  if (!user?.patientId) return <Spinner />;
  return <><PageHeader title="پرونده درمانی من" subtitle="ارزیابی‌ها، گزارش پیشرفت، شرح حال و اهداف درمانی شما" icon={<FolderHeart className="h-5 w-5" />} /><RecordsPanel patientId={user.patientId} initialTab={(sp.get("tab") as any) ?? "assessments"} /></>;
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
