"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { MessageThread } from "@/components/messages/Thread";

export default function ThreadPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { data } = useQuery({ queryKey: ["patient", patientId], queryFn: () => api.get<any>(`/patients/${patientId}`) });
  return (
    <>
      <PageHeader title={data ? `گفتگو با ${data.patient.fullName}` : "گفتگو"} subtitle={data ? <Link href={`/panel/patients/${patientId}`} className="text-brand-600 hover:underline">مشاهده پرونده {data.patient.fileNumber}</Link> : undefined} icon={<MessageCircle className="h-5 w-5" />} actions={<Link href="/panel/messages" className="btn-ghost"><ArrowRight className="h-4 w-4" />همه گفتگوها</Link>} />
      <MessageThread patientId={patientId} />
    </>
  );
}
