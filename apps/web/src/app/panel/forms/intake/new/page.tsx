"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { IntakeEditor } from "@/components/forms/IntakeEditor";
function Inner() { const sp = useSearchParams(); return <><PageHeader title="شرح حال جدید" icon={<ClipboardList className="h-5 w-5" />} /><IntakeEditor initialPatientId={sp.get("patientId") ?? undefined} /></>; }
export default function Page() { return <Suspense><Inner /></Suspense>; }
