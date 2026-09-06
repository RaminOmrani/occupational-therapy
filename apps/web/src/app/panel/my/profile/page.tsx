"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserCircle, KeyRound, Phone } from "lucide-react";
import { formatJalali, toPersianDigits, ageFromBirthDate, GENDER_LABELS } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, Card, PageHeader, Spinner } from "@/components/ui";
import { usePublicSettings } from "@/lib/settings";

export default function MyProfilePage() {
  const { user } = useAuth();
  const s = usePublicSettings();
  const { data, isLoading } = useQuery({ queryKey: ["patient", user?.patientId], queryFn: () => api.get<any>(`/patients/${user!.patientId}`), enabled: !!user?.patientId });
  if (isLoading || !data) return <Spinner />;
  const p = data.patient;
  return (
    <>
      <PageHeader title="پروفایل من" icon={<UserCircle className="h-5 w-5" />} actions={<Link href="/panel/account" className="btn-secondary"><KeyRound className="h-4 w-4" />تغییر رمز</Link>} />
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="flex flex-col items-center text-center md:col-span-1">
          <Avatar name={p.fullName} size="xl" />
          <h2 className="mt-3 text-lg font-bold">{p.fullName}</h2>
          <p className="num text-sm text-slate-500">شماره پرونده: <b className="text-brand-700">{p.fileNumber}</b></p>
          {p.primaryTherapistName && <p className="mt-1 text-xs text-slate-400">درمانگر: {p.primaryTherapistName}</p>}
        </Card>
        <Card title="اطلاعات ثبت‌شده" subtitle="برای اصلاح اطلاعات با پذیرش کلینیک تماس بگیرید" className="md:col-span-2">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[["نام", p.firstName], ["نام خانوادگی", p.lastName], ["شماره تماس", <span key="p" className="num" dir="ltr">{toPersianDigits(p.phone)}</span>], ["تاریخ تولد", p.birthDate ? `${formatJalali(p.birthDate)} (${toPersianDigits(ageFromBirthDate(p.birthDate))} سال)` : "-"], ["جنسیت", p.gender ? GENDER_LABELS[p.gender as keyof typeof GENDER_LABELS] : "-"], ["سرپرست", p.guardianName ?? "-"], ["تشخیص", p.diagnosis ?? "-"], ["تاریخ تشکیل پرونده", formatJalali(p.createdAt)]].map(([l, v], i) => <div key={i}><dt className="text-xs text-slate-400">{l}</dt><dd className="mt-0.5 font-medium">{v as any}</dd></div>)}
          </dl>
          <div className="mt-5 rounded-2xl bg-sand-100 p-4 text-sm"><p className="font-bold">تماس با کلینیک</p><p className="num mt-1 flex items-center gap-1 text-slate-600"><Phone className="h-3.5 w-3.5" />{toPersianDigits(s.str("clinic.phone"))}</p><p className="mt-1 text-xs text-slate-500">{s.str("clinic.workingHours")}</p></div>
        </Card>
      </div>
    </>
  );
}
