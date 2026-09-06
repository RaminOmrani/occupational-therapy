"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, Filter, Cake, Phone } from "lucide-react";
import { PATIENT_STATUSES, PATIENT_STATUS_LABELS, GENDERS, GENDER_LABELS, formatJalali, toPersianDigits, ageFromBirthDate } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/hooks";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, SearchInput, Select, Spinner } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";

function PatientsInner() {
  const sp = useSearchParams();
  const { user } = useAuth();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [status, setStatus] = useState("ACTIVE");
  const [therapistId, setTherapistId] = useState(sp.get("therapistId") ?? "");
  const [gender, setGender] = useState("");
  const [debt, setDebt] = useState(sp.get("debt") ?? "");
  const [birthdayWithin, setBirthdayWithin] = useState(sp.get("birthdayWithin") ?? "");
  const [page, setPage] = useState(1);
  const { data: therapists } = useTherapists();
  const params = { q, status, therapistId, gender, debt, birthdayWithin, page, pageSize: 20 };
  const { data, isLoading } = useQuery({ queryKey: ["patients", params], queryFn: () => api.get<any>("/patients", params), placeholderData: (p) => p });
  const pages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <>
      <PageHeader title="بیماران" subtitle={data ? `${toPersianDigits(data.total)} پرونده` : ""} icon={<Users className="h-5 w-5" />} actions={user?.role !== "THERAPIST" && <Link href="/panel/patients/new" className="btn-primary"><Plus className="h-4 w-4" />پرونده جدید</Link>} />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-6">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="نام، نام خانوادگی، شماره پرونده، موبایل، کد ملی..." className="md:col-span-2" autoFocus />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">همه وضعیت‌ها</option>{PATIENT_STATUSES.map((s) => <option key={s} value={s}>{PATIENT_STATUS_LABELS[s]}</option>)}</Select>
          <Select value={therapistId} onChange={(e) => { setTherapistId(e.target.value); setPage(1); }}><option value="">همه درمانگران</option>{therapists?.items.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select>
          <Select value={gender} onChange={(e) => setGender(e.target.value)}><option value="">همه جنسیت‌ها</option>{GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}</Select>
          <Select value={debt} onChange={(e) => { setDebt(e.target.value); setPage(1); }}><option value="">وضعیت مالی (همه)</option><option value="debtor">بدهکار</option><option value="settled">تسویه‌شده</option><option value="credit">بستانکار</option></Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <button onClick={() => setBirthdayWithin(birthdayWithin ? "" : "7")} className={`badge cursor-pointer ${birthdayWithin ? "bg-coral-500 text-white" : "bg-sand-200 text-slate-600"}`}><Cake className="h-3 w-3" />تولد در ۷ روز آینده</button>
          {(q || status !== "ACTIVE" || therapistId || gender || debt || birthdayWithin) && <button onClick={() => { setQ(""); setStatus("ACTIVE"); setTherapistId(""); setGender(""); setDebt(""); setBirthdayWithin(""); }} className="text-brand-600 hover:underline">پاک‌کردن فیلترها</button>}
        </div>
      </Card>
      <Card padded={false} className="overflow-x-auto">
        {isLoading && !data ? <Spinner /> : data?.items.length ? (
          <table className="table">
            <thead><tr><th>بیمار</th><th>شماره پرونده</th><th>موبایل</th><th>سن</th><th>درمانگر</th><th>تشخیص</th><th>وضعیت</th><th>ثبت</th></tr></thead>
            <tbody>
              {data.items.map((p: any) => {
                const age = ageFromBirthDate(p.birthDate);
                return (
                  <tr key={p.id}>
                    <td><Link href={`/panel/patients/${p.id}`} className="flex items-center gap-3 font-medium hover:text-brand-700"><Avatar name={p.fullName} size="sm" />{p.fullName}{p.daysToBirthday !== null && p.daysToBirthday <= 7 && <Cake className="h-4 w-4 text-coral-500" />}</Link></td>
                    <td className="num text-xs">{p.fileNumber}</td>
                    <td className="num text-xs" dir="ltr"><a href={`tel:${p.phone}`} className="flex items-center gap-1 hover:text-brand-700"><Phone className="h-3 w-3" />{toPersianDigits(p.phone)}</a></td>
                    <td className="num text-xs">{age !== null ? `${toPersianDigits(age)} سال` : "-"}</td>
                    <td className="text-xs">{p.primaryTherapistName ?? <span className="text-slate-300">-</span>}</td>
                    <td className="max-w-[180px] truncate text-xs text-slate-500">{p.diagnosis ?? "-"}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="num text-xs text-slate-400">{formatJalali(p.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="بیماری یافت نشد" description="فیلترها را تغییر دهید یا پرونده جدید بسازید" action={<Link href="/panel/patients/new" className="btn-primary">پرونده جدید</Link>} />}
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</Button>
          <span className="num">صفحه {toPersianDigits(page)} از {toPersianDigits(pages)}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی</Button>
        </div>
      )}
    </>
  );
}

export default function PatientsPage() {
  return <Suspense><PatientsInner /></Suspense>;
}
