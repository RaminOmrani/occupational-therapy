"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSignature, Check, Printer } from "lucide-react";
import Link from "next/link";
import { formatJalaliDateTime } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, Field, Input, PageHeader, Spinner, Toggle } from "@/components/ui";
import { SignaturePad } from "@/components/ui/SignaturePad";

export default function ConsentPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["consent-status", "me"], queryFn: () => api.get<any>("/consents/status/me") });
  const [name, setName] = useState(user ? `${user.firstName} ${user.lastName}` : "");
  const [agree, setAgree] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sign = async () => {
    if (!agree) return toast.error("لطفاً پذیرش متن رضایت‌نامه را تأیید کنید");
    if (!sig) return toast.error("لطفاً امضا کنید");
    setLoading(true);
    try { await api.post("/consents/sign", { signerName: name, signatureData: sig }); toast.success("رضایت‌نامه با موفقیت امضا شد"); qc.invalidateQueries({ queryKey: ["consent-status"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  if (isLoading || !data) return <Spinner />;
  return (
    <>
      <PageHeader title={data.template.title} subtitle="امضای دیجیتال رضایت‌نامه درمان" icon={<FileSignature className="h-5 w-5" />} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2"><div className="whitespace-pre-line text-sm leading-8 text-slate-700">{data.template.content}</div></Card>
        <div className="space-y-4">
          {data.signed ? (
            <Card className="border-sage-300 bg-sage-100/40"><div className="flex items-center gap-2 font-bold text-sage-700"><Check className="h-5 w-5" />امضا شده</div><p className="mt-2 text-sm">توسط {data.signed.signerName}</p><p className="text-xs text-slate-500">{formatJalaliDateTime(data.signed.signedAt)}</p><Link href={`/panel/consents/${data.signed.id}`} className="btn-secondary mt-3 w-full"><Printer className="h-4 w-4" />مشاهده / چاپ</Link></Card>
          ) : (
            <Card title="امضای رضایت‌نامه">
              <Field label="نام و نام خانوادگی امضاکننده" hint="در مورد کودکان، نام ولی/سرپرست"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <div className="mt-3"><label className="label">امضا</label><SignaturePad onChange={setSig} /></div>
              <div className="mt-3"><Toggle checked={agree} onChange={setAgree} label="متن رضایت‌نامه را خواندم و می‌پذیرم" /></div>
              <Button className="mt-4 w-full" loading={loading} onClick={sign} icon={<FileSignature className="h-4 w-4" />}>ثبت امضا</Button>
            </Card>
          )}
          {data.history.length > 1 && <Card title="نسخه‌های قبلی"><ul className="space-y-1 text-xs">{data.history.slice(1).map((h: any) => <li key={h.id}><Link href={`/panel/consents/${h.id}`} className="text-brand-600 hover:underline">{formatJalaliDateTime(h.signedAt)}</Link></li>)}</ul></Card>}
        </div>
      </div>
    </>
  );
}
