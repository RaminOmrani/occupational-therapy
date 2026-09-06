"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { Card, PageHeader } from "@/components/ui";
import { PatientForm } from "@/components/patient/PatientForm";

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const leadId = sp.get("leadId") ?? undefined;
  const { data: lead } = useQuery({ queryKey: ["lead", leadId], queryFn: () => api.get<any>(`/leads/${leadId}`), enabled: !!leadId });
  const initial = lead ? { firstName: lead.lead.firstName === "ناشناس" ? "" : lead.lead.firstName, lastName: lead.lead.lastName, phone: lead.lead.phone, diagnosis: lead.lead.interest ?? "", referralSource: "لید CRM" } : undefined;
  if (leadId && !lead) return null;
  return (
    <>
      <PageHeader title="پرونده جدید" subtitle={leadId ? `تبدیل لید ${lead?.lead.leadNumber} به بیمار` : "شماره پرونده به‌صورت خودکار اختصاص داده می‌شود"} icon={<UserPlus className="h-5 w-5" />} />
      <Card className="max-w-3xl">
        <PatientForm initial={initial} leadId={leadId} onSaved={(p) => router.push(`/panel/patients/${p.id}`)} onCancel={() => router.back()} />
      </Card>
    </>
  );
}
export default function NewPatientPage() {
  return <Suspense><Inner /></Suspense>;
}
