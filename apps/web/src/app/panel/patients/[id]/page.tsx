"use client";
import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Phone, Cake, CalendarPlus, MessageSquareText, KeyRound, UserCheck, FileText, Upload, Trash2, Wallet, FolderHeart, CalendarDays, MessageSquareHeart, MessageCircle, FileSignature } from "lucide-react";
import { formatJalali, formatJalaliLong, formatTime, formatMoney, toPersianDigits, ageFromBirthDate, GENDER_LABELS, FEEDBACK_TYPE_LABELS } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Tabs, Textarea, useConfirm } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PatientForm } from "@/components/patient/PatientForm";
import { FinancePanel } from "@/components/patient/FinancePanel";
import { RecordsPanel } from "@/components/patient/RecordsPanel";
import { AppointmentModal } from "@/components/schedule/AppointmentModal";

type Tab = "overview" | "records" | "finance" | "documents" | "feedback";

function Inner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) ?? "overview");
  const [edit, setEdit] = useState(false);
  const [sms, setSms] = useState(false);
  const [appt, setAppt] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["patient", id], queryFn: () => api.get<any>(`/patients/${id}`) });
  const consent = useQuery({ queryKey: ["consent-status", id], queryFn: () => api.get<any>(`/consents/status/${id}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["patient", id] });
  if (isLoading || !data) return <Spinner />;
  const p = data.patient;
  const age = ageFromBirthDate(p.birthDate);
  const canEdit = user?.role !== "THERAPIST";
  const canFinance = user?.role === "ADMIN" || user?.role === "SECRETARY";

  const createAccount = async () => { try { await api.post(`/patients/${id}/account`); toast.success("حساب کاربری ساخته شد"); refresh(); } catch (e: any) { toast.error(e.message); } };
  const resetPw = async () => { try { const r = await api.post<{ message: string }>(`/patients/${id}/reset-password`); toast.success(r.message); } catch (e: any) { toast.error(e.message); } };

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={p.fullName} size="lg" />{p.fullName}</span>}
        subtitle={<span className="flex flex-wrap items-center gap-2"><span className="num">پرونده {p.fileNumber}</span>·<StatusBadge status={p.status} />{p.tags.map((t: string) => <Badge key={t} tone="sky">{t}</Badge>)}{p.daysToBirthday !== null && p.daysToBirthday <= 7 && <Badge tone="coral"><Cake className="h-3 w-3" />{p.daysToBirthday === 0 ? "تولدش امروز است!" : `${toPersianDigits(p.daysToBirthday)} روز تا تولد`}</Badge>}</span>}
        actions={<>
          {canEdit && <Button variant="secondary" onClick={() => setEdit(true)} icon={<Pencil className="h-4 w-4" />}>ویرایش</Button>}
          {canFinance && <Button variant="secondary" onClick={() => setSms(true)} icon={<MessageSquareText className="h-4 w-4" />}>پیامک</Button>}
          <Link href={`/panel/messages/${id}`} className="btn-secondary"><MessageCircle className="h-4 w-4" />پیام</Link>
          <Button onClick={() => setAppt(true)} icon={<CalendarPlus className="h-4 w-4" />}>نوبت جدید</Button>
        </>}
      />
      <Tabs value={tab} onChange={setTab} className="mb-5" tabs={[{ key: "overview", label: "خلاصه" }, { key: "records", label: "پرونده بالینی" }, { key: "finance", label: "پروفایل مالی" }, { key: "documents", label: "مدارک" }, { key: "feedback", label: "بازخوردها" }]} />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="اطلاعات فردی" className="lg:col-span-2">
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["موبایل", <a key="p" href={`tel:${p.phone}`} className="num flex items-center gap-1 text-brand-700" dir="ltr"><Phone className="h-3.5 w-3.5" />{toPersianDigits(p.phone)}</a>],
                ["تاریخ تولد", p.birthDate ? `${formatJalali(p.birthDate)} (${toPersianDigits(age)} سال)` : "-"],
                ["جنسیت", p.gender ? GENDER_LABELS[p.gender as keyof typeof GENDER_LABELS] : "-"],
                ["کد ملی", p.nationalId ? toPersianDigits(p.nationalId) : "-"],
                ["سرپرست", p.guardianName ? `${p.guardianName}${p.guardianPhone ? ` (${toPersianDigits(p.guardianPhone)})` : ""}` : "-"],
                ["درمانگر اصلی", p.primaryTherapistName ?? "-"],
                ["نحوه آشنایی", p.referralSource ?? "-"],
                ["تاریخ ثبت", formatJalali(p.createdAt)],
                ["حساب کاربری", p.hasAccount ? <span key="a" className="text-sage-700">فعال {p.user?.lastLoginAt ? `· آخرین ورود ${formatJalali(p.user.lastLoginAt)}` : "· هنوز وارد نشده"}</span> : <span key="b" className="text-slate-400">ندارد</span>],
              ].map(([l, v], i) => <div key={i}><dt className="text-xs text-slate-400">{l}</dt><dd className="mt-0.5 font-medium">{v as any}</dd></div>)}
              <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs text-slate-400">تشخیص / علت مراجعه</dt><dd className="mt-0.5 leading-6">{p.diagnosis ?? "-"}</dd></div>
              {p.address && <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs text-slate-400">آدرس</dt><dd className="mt-0.5">{p.address}</dd></div>}
              {p.notes && user?.role !== "PATIENT" && <div className="sm:col-span-2 lg:col-span-3 rounded-xl bg-amber-400/10 p-3"><dt className="text-xs text-amber-600">یادداشت داخلی</dt><dd className="mt-0.5 leading-6">{p.notes}</dd></div>}
            </dl>
            {canEdit && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-sand-200 pt-4">
                {!p.hasAccount ? <Button variant="secondary" size="sm" onClick={createAccount} icon={<UserCheck className="h-4 w-4" />}>ساخت حساب کاربری</Button> : <Button variant="ghost" size="sm" onClick={resetPw} icon={<KeyRound className="h-4 w-4" />}>بازنشانی رمز به شماره پرونده</Button>}
              </div>
            )}
          </Card>
          <div className="space-y-5">
            <Card title="جلسه بعدی" actions={<CalendarDays className="h-4 w-4 text-slate-400" />}>
              {data.nextAppointment ? (
                <div className="rounded-2xl bg-brand-50 p-4">
                  <p className="font-bold text-brand-800">{formatJalaliLong(data.nextAppointment.startAt, true)}</p>
                  <p className="num mt-1 text-sm">ساعت {formatTime(data.nextAppointment.startAt)} · {data.nextAppointment.therapist.user.firstName} {data.nextAppointment.therapist.user.lastName}</p>
                  <div className="mt-2"><StatusBadge status={data.nextAppointment.status} /></div>
                </div>
              ) : <p className="text-sm text-slate-400">نوبت آینده‌ای ندارد</p>}
              {data.lastAppointment && <p className="mt-3 text-xs text-slate-400">آخرین جلسه: {formatJalali(data.lastAppointment.startAt)}</p>}
            </Card>
            <Card title="وضعیت مالی" actions={<button onClick={() => setTab("finance")} className="text-xs text-brand-600 hover:underline">جزئیات</button>}>
              <p className={`num text-2xl font-black ${data.finance.balance > 0 ? "text-coral-600" : "text-sage-700"}`}>{data.finance.balance === 0 ? "تسویه ✅" : formatMoney(Math.abs(data.finance.balance))}</p>
              <p className="text-xs text-slate-400">{data.finance.balance > 0 ? "بدهکار" : data.finance.balance < 0 ? "بستانکار" : ""}</p>
              <div className="mt-3 flex justify-between text-sm"><span className="text-slate-500">کیف پول</span><b className="num">{formatMoney(data.finance.walletBalance)}</b></div>
            </Card>
            {consent.data && (
              <Card title="رضایت‌نامه" actions={<FileSignature className="h-4 w-4 text-slate-400" />}>
                {consent.data.signed ? <p className="text-sm text-sage-700">امضا شده توسط {consent.data.signed.signerName} · <Link href={`/panel/consents/${consent.data.signed.id}`} className="text-brand-600 hover:underline">مشاهده</Link></p> : consent.data.pending ? <p className="text-sm text-amber-600">هنوز امضا نشده؛ بیمار از پنل خود می‌تواند امضا کند.</p> : <p className="text-sm text-slate-400">الزامی نیست</p>}
              </Card>
            )}
            <Card title="آمار درمان">
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                {[["جلسات انجام‌شده", data.stats.sessionsDone], ["ارزیابی", data.stats.assessments], ["گزارش پیشرفت", data.stats.progressNotes], ["شرح حال", data.stats.intakeForms]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-sand-100 p-2"><p className="num text-lg font-black text-brand-700">{toPersianDigits(v as number)}</p><p className="text-[11px] text-slate-500">{l}</p></div>)}
              </div>
            </Card>
          </div>
        </div>
      )}
      {tab === "records" && <RecordsPanel patientId={id} />}
      {tab === "finance" && <FinancePanel patientId={id} />}
      {tab === "documents" && <DocumentsTab patientId={id} />}
      {tab === "feedback" && <FeedbackTab patientId={id} />}

      <Modal open={edit} onClose={() => setEdit(false)} title="ویرایش اطلاعات بیمار" size="lg">
        <PatientForm initial={p} patientId={id} onSaved={() => { setEdit(false); refresh(); }} onCancel={() => setEdit(false)} />
      </Modal>
      {sms && <SmsModal patient={p} onClose={() => setSms(false)} />}
      {appt && <AppointmentModal open onClose={() => setAppt(false)} initial={{ patientId: id, patientLabel: `${p.fullName} (${p.fileNumber})`, therapistId: p.primaryTherapistId ?? "" }} onSaved={() => { setAppt(false); refresh(); }} />}
    </>
  );
}

function SmsModal({ patient, onClose }: { patient: any; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const send = async () => {
    setLoading(true);
    try { await api.post("/sms/send", { to: patient.phone, message, patientId: patient.id }); toast.success("پیامک ارسال شد"); onClose(); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title={`پیامک به ${patient.fullName}`} size="sm" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={send} disabled={!message.trim()}>ارسال</Button></>}>
      <Field label="متن پیام" hint="امضای کلینیک به‌صورت خودکار اضافه می‌شود"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} autoFocus className="min-h-[120px]" /></Field>
      <p className="mt-2 text-xs text-slate-400 num">{toPersianDigits(message.length)} کاراکتر</p>
    </Modal>
  );
}

function DocumentsTab({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["documents", patientId], queryFn: () => api.get<{ items: any[] }>(`/patients/${patientId}/documents`) });
  const [uploading, setUploading] = useState(false);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("title", f.name);
      await api.post(`/uploads/patients/${patientId}/documents`, fd);
      toast.success("فایل بارگذاری شد");
      qc.invalidateQueries({ queryKey: ["documents", patientId] });
    } catch (err: any) { toast.error(err.message); } finally { setUploading(false); e.target.value = ""; }
  };
  const remove = async (id: string) => { if (!(await confirm("این فایل حذف شود؟"))) return; await api.delete(`/documents/${id}`); qc.invalidateQueries({ queryKey: ["documents", patientId] }); };
  return (
    <Card title="مدارک و فایل‌ها" subtitle="نسخه پزشک، گزارش‌های پاراکلینیک، تصاویر" actions={<label className="btn-primary cursor-pointer"><Upload className="h-4 w-4" />{uploading ? "در حال بارگذاری..." : "بارگذاری فایل"}<input type="file" className="hidden" accept="image/*,application/pdf" onChange={upload} disabled={uploading} /></label>}>
      {dialog}
      {isLoading ? <Spinner /> : data?.items.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-sand-200 p-3">
              {d.mimeType?.startsWith("image/") ? <img src={d.fileUrl} alt={d.title} className="h-14 w-14 rounded-xl object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-xl bg-sand-100 text-slate-400"><FileText className="h-6 w-6" /></span>}
              <div className="min-w-0 flex-1"><a href={d.fileUrl} target="_blank" className="block truncate text-sm font-medium hover:text-brand-700">{d.title}</a><p className="text-xs text-slate-400">{formatJalali(d.createdAt)} · {toPersianDigits(Math.round((d.size ?? 0) / 1024))} KB</p></div>
              <button onClick={() => remove(d.id)} className="text-slate-400 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="مدرکی بارگذاری نشده" icon={<FileText className="h-6 w-6" />} />}
    </Card>
  );
}

function FeedbackTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["feedback", patientId], queryFn: () => api.get<{ items: any[] }>("/feedback", { patientId }) });
  if (isLoading) return <Spinner />;
  return data?.items.length ? (
    <div className="space-y-3">
      {data.items.map((f) => (
        <Card key={f.id}>
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-bold"><MessageSquareHeart className="h-4 w-4 text-coral-500" />{f.subject}</span><span className="flex items-center gap-2"><Badge tone={f.type === "COMPLAINT" ? "coral" : f.type === "PRAISE" ? "sage" : "amber"}>{FEEDBACK_TYPE_LABELS[f.type as keyof typeof FEEDBACK_TYPE_LABELS]}</Badge><StatusBadge status={f.status} /></span></div>
          <p className="mt-2 text-sm leading-7">{f.message}</p>
          {f.reply && <p className="mt-2 rounded-xl bg-brand-50 p-3 text-sm"><b>پاسخ: </b>{f.reply}</p>}
          <p className="mt-2 text-xs text-slate-400">{formatJalaliLong(f.createdAt)}</p>
        </Card>
      ))}
    </div>
  ) : <EmptyState title="بازخوردی ثبت نشده" icon={<MessageSquareHeart className="h-6 w-6" />} />;
}

export default function PatientPage() {
  return <Suspense><Inner /></Suspense>;
}
