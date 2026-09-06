"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ProgressEditor } from "@/components/forms/ProgressEditor";
function Inner() { const sp = useSearchParams(); return <><PageHeader title="گزارش جلسه جدید" icon={<TrendingUp className="h-5 w-5" />} /><ProgressEditor initialPatientId={sp.get("patientId") ?? undefined} appointmentId={sp.get("appointmentId") ?? undefined} /></>; }
export default function Page() { return <Suspense><Inner /></Suspense>; }
