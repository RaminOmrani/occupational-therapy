"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { formatJalaliDateTime } from "@toranj/shared";
import { api } from "@/lib/api";
import { Button, Spinner } from "@/components/ui";
import { LogoMark } from "@/components/layout/Logo";

export default function ConsentViewPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({ queryKey: ["consent", id], queryFn: () => api.get<any>(`/consents/${id}`) });
  if (isLoading || !data) return <Spinner />;
  const c = data.consent;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex justify-end"><Button onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>چاپ</Button></div>
      <div className="card p-8 print:border-0 print:shadow-none">
        <div className="flex items-center gap-3 border-b border-sand-200 pb-4"><LogoMark /><div><h1 className="text-lg font-black text-brand-800">{data.clinic}</h1><p className="text-sm text-slate-500">{c.title}</p></div></div>
        <p className="mt-4 text-sm">بیمار: <b>{c.patient.firstName} {c.patient.lastName}</b> <span className="num text-slate-500">({c.patient.fileNumber})</span></p>
        <div className="mt-4 whitespace-pre-line text-sm leading-8">{c.content}</div>
        <div className="mt-8 flex items-end justify-between border-t border-sand-200 pt-4">
          <div className="text-sm"><p>امضاکننده: <b>{c.signerName}</b></p><p className="num text-xs text-slate-500">تاریخ: {formatJalaliDateTime(c.signedAt)}</p></div>
          <img src={c.signatureData} alt="امضا" className="h-24 rounded-xl border border-sand-200 bg-white" />
        </div>
      </div>
    </div>
  );
}
