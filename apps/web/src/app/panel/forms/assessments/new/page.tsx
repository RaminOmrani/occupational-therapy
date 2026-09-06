"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { AssessmentEditor } from "@/components/forms/AssessmentEditor";
function Inner() { const sp = useSearchParams(); return <><PageHeader title="ارزیابی جدید" icon={<Activity className="h-5 w-5" />} /><AssessmentEditor initialPatientId={sp.get("patientId") ?? undefined} initialType={(sp.get("type") as any) ?? undefined} /></>; }
export default function Page() { return <Suspense><Inner /></Suspense>; }
