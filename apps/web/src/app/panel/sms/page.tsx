"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquareText, Send, Users, FileText, History, Wifi, WifiOff, Eye, Save, Plus, Info, Filter, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_SOURCES, LEAD_SOURCE_LABELS, PATIENT_STATUSES, PATIENT_STATUS_LABELS, GENDERS, GENDER_LABELS, formatJalaliDateTime, toPersianDigits, formatMoney } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/hooks";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Select, Spinner, Tabs, Textarea, Toggle } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PatientPicker } from "@/components/ui/PatientPicker";

type Tab = "send" | "group" | "templates" | "logs" | "campaigns";

function Inner() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) ?? "send");
  const status = useQuery({ queryKey: ["sms-status"], queryFn: () => api.get<any>("/sms/status"), staleTime: 60_000 });
  const s = status.data;
  return (
    <>
      <PageHeader title="پیامک" subtitle="ارسال تکی و گروهی، الگوها و گزارش ارسال" icon={<MessageSquareText className="h-5 w-5" />} actions={s && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${s.configured ? "bg-sage-100 text-sage-700" : "bg-amber-400/20 text-amber-600"}`}>
          {s.configured ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {s.configured ? `متصل به ${s.provider}${s.credit?.credit != null ? ` · اعتبار: ${toPersianDigits(Math.round(s.credit.credit))}` : ""}` : "حالت آزمایشی (mock): پیامک واقعی ارسال نمی‌شود"}
          <span className="num text-slate-400">| امروز {toPersianDigits(s.stats.today)} · ناموفق {toPersianDigits(s.stats.failed)}</span>
        </div>
      )} />
      <Tabs value={tab} onChange={setTab} className="mb-5" tabs={[{ key: "send", label: <span className="flex items-center gap-1"><Send className="h-4 w-4" />ارسال تکی</span> }, { key: "group", label: <span className="flex items-center gap-1"><Users className="h-4 w-4" />ارسال گروهی</span> }, { key: "templates", label: <span className="flex items-center gap-1"><FileText className="h-4 w-4" />الگوها</span> }, { key: "campaigns", label: "کمپین‌ها" }, { key: "logs", label: <span className="flex items-center gap-1"><History className="h-4 w-4" />گزارش ارسال</span> }]} />
      {tab === "send" && <SingleSend />}
      {tab === "group" && <GroupSend onDone={() => setTab("campaigns")} />}
      {tab === "templates" && <Templates />}
      {tab === "campaigns" && <Campaigns />}
      {tab === "logs" && <Logs />}
    </>
  );
}

function SingleSend() {
  const [mode, setMode] = useState<"patient" | "phone">("patient");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const send = async () => {
    const to = mode === "patient" ? patientPhone : phone;
    if (!to) return toast.error("گیرنده را مشخص کنید");
    setLoading(true);
    try { await api.post("/sms/send", { to, message, patientId: mode === "patient" ? patientId : undefined }); toast.success("پیامک ارسال شد"); setMessage(""); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Card className="max-w-2xl">
      <Tabs value={mode} onChange={setMode} className="mb-4" tabs={[{ key: "patient", label: "به بیمار" }, { key: "phone", label: "به شماره دلخواه" }]} />
      {mode === "patient" ? <Field label="بیمار"><PatientPicker value={patientId} onChange={(id, p) => { setPatientId(id); setPatientPhone(p?.phone ?? ""); }} /></Field> : <Field label="شماره موبایل"><Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="num text-left" placeholder="09123456789" /></Field>}
      <Field label="متن پیام" hint="امضای کلینیک به‌صورت خودکار به انتهای پیام اضافه می‌شود" className="mt-4"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[140px]" /></Field>
      <div className="mt-3 flex items-center justify-between"><span className="num text-xs text-slate-400">{toPersianDigits(message.length)} کاراکتر · حدود {toPersianDigits(Math.ceil(message.length / 70) || 1)} پیامک</span><Button loading={loading} onClick={send} disabled={!message.trim()} icon={<Send className="h-4 w-4" />}>ارسال</Button></div>
    </Card>
  );
}

function GroupSend({ onDone }: { onDone: () => void }) {
  const { data: therapists } = useTherapists();
  const [f, setF] = useState<any>({ audience: "patients", status: "ACTIVE" });
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [phones, setPhones] = useState("");
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const filters = () => {
    const out: any = { audience: f.audience };
    if (f.audience === "custom") out.phones = phones.split(/[\n,،\s]+/).filter(Boolean);
    else if (f.audience === "leads") { if (f.leadStatus) out.leadStatus = f.leadStatus; if (f.leadSource) out.leadSource = f.leadSource; }
    else { for (const k of ["status", "therapistId", "gender", "debt", "tag"]) if (f[k]) out[k] = f[k]; for (const k of ["birthdayWithin", "ageMin", "ageMax", "lastVisitDays"]) if (f[k] !== "" && f[k] !== undefined) out[k] = Number(f[k]); }
    return out;
  };
  const doPreview = async () => { try { setPreview(await api.post("/sms/recipients", filters())); } catch (e: any) { toast.error(e.message); } };
  const send = async () => {
    if (!name.trim() || !message.trim()) return toast.error("نام کمپین و متن پیام الزامی است");
    setLoading(true);
    try { const r = await api.post<{ total: number }>("/sms/campaigns", { name, message, filters: filters() }); toast.success(`ارسال به ${toPersianDigits(r.total)} گیرنده آغاز شد`); onDone(); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const set = (k: string, v: any) => { setF({ ...f, [k]: v }); setPreview(null); };
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title="۱. گیرندگان را فیلتر کنید" className="lg:col-span-2" subtitle="مثل CRM: بر اساس درمانگر، وضعیت مالی، تولد نزدیک، سن، آخرین مراجعه و...">
        <Tabs value={f.audience} onChange={(a) => { setF({ audience: a, status: "ACTIVE" }); setPreview(null); }} className="mb-4" tabs={[{ key: "patients", label: "بیماران" }, { key: "leads", label: "لیدها" }, { key: "custom", label: "شماره‌های دلخواه" }]} />
        {f.audience === "patients" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="وضعیت پرونده"><Select value={f.status ?? ""} onChange={(e) => set("status", e.target.value)}><option value="">همه (غیر بایگانی)</option>{PATIENT_STATUSES.map((s) => <option key={s} value={s}>{PATIENT_STATUS_LABELS[s]}</option>)}</Select></Field>
            <Field label="درمانگر"><Select value={f.therapistId ?? ""} onChange={(e) => set("therapistId", e.target.value)}><option value="">همه</option>{therapists?.items.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select></Field>
            <Field label="جنسیت"><Select value={f.gender ?? ""} onChange={(e) => set("gender", e.target.value)}><option value="">همه</option>{GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}</Select></Field>
            <Field label="وضعیت مالی"><Select value={f.debt ?? ""} onChange={(e) => set("debt", e.target.value)}><option value="">همه</option><option value="debtor">بدهکاران</option><option value="settled">تسویه‌شده‌ها</option><option value="credit">بستانکاران</option></Select></Field>
            <Field label="تولد در N روز آینده"><Input type="number" value={f.birthdayWithin ?? ""} onChange={(e) => set("birthdayWithin", e.target.value)} className="num" dir="ltr" placeholder="مثلاً 7" /></Field>
            <Field label="آخرین مراجعه بیش از N روز پیش"><Input type="number" value={f.lastVisitDays ?? ""} onChange={(e) => set("lastVisitDays", e.target.value)} className="num" dir="ltr" placeholder="مثلاً 30" /></Field>
            <Field label="حداقل سن"><Input type="number" value={f.ageMin ?? ""} onChange={(e) => set("ageMin", e.target.value)} className="num" dir="ltr" /></Field>
            <Field label="حداکثر سن"><Input type="number" value={f.ageMax ?? ""} onChange={(e) => set("ageMax", e.target.value)} className="num" dir="ltr" /></Field>
            <Field label="برچسب"><Input value={f.tag ?? ""} onChange={(e) => set("tag", e.target.value)} placeholder="مثلاً: کودک" /></Field>
          </div>
        )}
        {f.audience === "leads" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="وضعیت لید"><Select value={f.leadStatus ?? ""} onChange={(e) => set("leadStatus", e.target.value)}><option value="">همه</option>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}</Select></Field>
            <Field label="منبع"><Select value={f.leadSource ?? ""} onChange={(e) => set("leadSource", e.target.value)}><option value="">همه</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>)}</Select></Field>
          </div>
        )}
        {f.audience === "custom" && <Field label="شماره‌ها (هر خط یک شماره)"><Textarea value={phones} onChange={(e) => { setPhones(e.target.value); setPreview(null); }} dir="ltr" className="num min-h-[140px]" placeholder="09123456789&#10;09351234567" /></Field>}
        <div className="mt-4 flex items-center gap-3">
          <Button variant="secondary" onClick={doPreview} icon={<Eye className="h-4 w-4" />}>نمایش گیرندگان</Button>
          {preview && <span className="text-sm"><b className="num text-brand-700">{toPersianDigits(preview.count)}</b> گیرنده</span>}
        </div>
        {preview && preview.items.length > 0 && <div className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-sand-100 p-3 text-xs"><div className="flex flex-wrap gap-1.5">{preview.items.map((r: any) => <span key={r.phone} className="rounded-lg bg-white px-2 py-1">{r.name || toPersianDigits(r.phone)}</span>)}</div></div>}
      </Card>
      <Card title="۲. پیام را بنویسید">
        <Field label="نام کمپین" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: یادآوری بدهی شهریور" /></Field>
        <Field label="متن پیام" required hint="{{name}} با نام هر گیرنده جایگزین می‌شود. امضا خودکار اضافه می‌شود." className="mt-3"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[160px]" placeholder="{{name}} عزیز، ..." /></Field>
        <p className="num mt-2 text-xs text-slate-400">{toPersianDigits(message.length)} کاراکتر</p>
        <Button className="mt-4 w-full" loading={loading} onClick={send} disabled={!preview?.count} icon={<Send className="h-4 w-4" />}>ارسال به {preview ? toPersianDigits(preview.count) : "…"} نفر</Button>
        {!preview && <p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><Info className="h-3 w-3" />ابتدا گیرندگان را نمایش دهید</p>}
      </Card>
    </div>
  );
}

function Templates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const { data, isLoading } = useQuery({ queryKey: ["sms-templates"], queryFn: () => api.get<{ items: any[] }>("/sms/templates") });
  const [edit, setEdit] = useState<any | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const patternArgs = String(edit.patternArgsText ?? "").split(/[،,]/).map((x: string) => x.trim()).filter(Boolean);
      if (edit.id) await api.patch(`/sms/templates/${edit.id}`, { name: edit.name, body: edit.body, patternCode: edit.patternCode || null, patternArgs, isActive: edit.isActive, description: edit.description });
      else await api.post("/sms/templates", { key: edit.key, name: edit.name, body: edit.body, patternCode: edit.patternCode || null, patternArgs: patternArgs.length ? patternArgs : undefined, description: edit.description });
      toast.success("الگو ذخیره شد"); setEdit(null); qc.invalidateQueries({ queryKey: ["sms-templates"] });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  const doPreview = async () => { const r = await api.post<{ text: string }>("/sms/templates/preview", { body: edit.body }); setPreview(r.text); };
  if (isLoading) return <Spinner />;
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-start gap-1 text-xs leading-6 text-slate-500"><Info className="mt-1 h-3.5 w-3.5 shrink-0" />خط خدماتی اشتراکی ملی‌پیامک فقط الگوهای تأییدشده را می‌فرستد. برای هر الگو: متن «برای ثبت در ملی‌پیامک» را کپی کنید ← در پنل ملی‌پیامک (توسعه‌دهندگان ← وب‌سرویس خدماتی/الگو) ثبت کنید ← پس از تأیید، کد الگو را با «ویرایش» همین‌جا وارد کنید. لینک داخل متغیر ممنوع است.</p>
        {isAdmin && <Button size="sm" onClick={() => setEdit({ key: "", name: "", body: "", patternCode: "", description: "", isActive: true })} icon={<Plus className="h-4 w-4" />}>الگوی جدید</Button>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {data?.items.map((t) => (
          <Card key={t.id} className={!t.isActive ? "opacity-60" : ""}>
            <div className="flex items-start justify-between gap-2">
              <div><h3 className="font-bold">{t.name}</h3><p className="num text-xs text-slate-400">{t.key}{t.patternCode ? ` · کد الگو: ${t.patternCode}` : ""}</p></div>
              <div className="flex items-center gap-1">{t.isSystem && <Badge tone="brand">سیستمی</Badge>}{!t.isActive && <Badge tone="slate">غیرفعال</Badge>}</div>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-sand-100 p-3 font-sans text-sm leading-6">{t.body}</pre>
            {t.description && <p className="mt-2 text-xs text-slate-400">{t.description}</p>}
            <div className="mt-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-brand-800">متن برای ثبت در ملی‌پیامک (خط خدماتی ← الگو)</p>
                <button onClick={() => { navigator.clipboard?.writeText(t.providerText); toast.success("متن الگو کپی شد"); }} className="flex items-center gap-1 text-[11px] text-brand-600 hover:underline"><Copy className="h-3 w-3" />کپی</button>
              </div>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-6 text-slate-700" dir="rtl">{t.providerText}</pre>
              <p className="mt-1 text-[11px] text-slate-400">ترتیب متغیرها: {t.patternArgs.map((a: string, i: number) => `{${i}} = ${a}`).join("، ") || "بدون متغیر"}</p>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[11px]">{t.patternCode ? <><CheckCircle2 className="h-3.5 w-3.5 text-sage-700" /><span className="text-sage-700">کد الگو ثبت شده: <b className="num">{t.patternCode}</b></span></> : <><AlertCircle className="h-3.5 w-3.5 text-amber-500" /><span className="text-amber-600">کد الگو وارد نشده؛ تا ثبت نشود ارسال نمی‌شود</span></>}</div>
            {isAdmin && <button onClick={() => { setEdit({ ...t, patternArgsText: (t.patternArgs ?? []).join(", ") }); setPreview(""); }} className="mt-3 text-xs text-brand-600 hover:underline">ویرایش / ثبت کد الگو</button>}
          </Card>
        ))}
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? `ویرایش الگو «${edit.name}»` : "الگوی جدید"} size="lg" footer={<><Button variant="ghost" onClick={doPreview} icon={<Eye className="h-4 w-4" />}>پیش‌نمایش</Button><Button variant="secondary" onClick={() => setEdit(null)}>انصراف</Button><Button loading={saving} onClick={save} icon={<Save className="h-4 w-4" />}>ذخیره</Button></>}>
          <div className="grid gap-3 sm:grid-cols-2">
            {!edit.id && <Field label="کلید (انگلیسی)" required hint="مثال: summer_offer"><Input value={edit.key} onChange={(e) => setEdit({ ...edit, key: e.target.value })} dir="ltr" /></Field>}
            <Field label="نام" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="کد الگوی ملی‌پیامک (bodyId)" hint="کدی که ملی‌پیامک بعد از تأیید الگو می‌دهد"><Input value={edit.patternCode ?? ""} onChange={(e) => setEdit({ ...edit, patternCode: e.target.value })} dir="ltr" className="num" /></Field>
            <Field label="ترتیب متغیرها در الگوی ملی‌پیامک" hint="به ترتیب {0}, {1}, ... با ویرگول؛ نام کلینیک ثابت در متن است" className="sm:col-span-2"><Input value={edit.patternArgsText ?? ""} onChange={(e) => setEdit({ ...edit, patternArgsText: e.target.value })} dir="ltr" className="num" placeholder="name, date, time" /></Field>
            <Field label="متن الگو" required className="sm:col-span-2" hint="متغیرها را با {{name}} بنویسید"><Textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} className="min-h-[140px]" dir="rtl" /></Field>
            <Field label="توضیح" className="sm:col-span-2"><Input value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            {edit.id && <div className="sm:col-span-2"><Toggle checked={edit.isActive} onChange={(c) => setEdit({ ...edit, isActive: c })} label="فعال" /></div>}
          </div>
          {preview && <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-3"><p className="mb-1 text-xs text-brand-700">پیش‌نمایش با داده نمونه:</p><pre className="whitespace-pre-wrap font-sans text-sm leading-6">{preview}</pre></div>}
        </Modal>
      )}
    </>
  );
}

function Campaigns() {
  const { data, isLoading } = useQuery({ queryKey: ["sms-campaigns"], queryFn: () => api.get<{ items: any[] }>("/sms/campaigns"), refetchInterval: 5000 });
  if (isLoading) return <Spinner />;
  return (
    <Card padded={false} className="overflow-x-auto">
      {data?.items.length ? (
        <table className="table"><thead><tr><th>نام</th><th>تاریخ</th><th>گیرندگان</th><th>ارسال‌شده</th><th>ناموفق</th><th>پیشرفت</th><th>ایجادکننده</th></tr></thead>
          <tbody>{data.items.map((c) => { const pct = c.total ? Math.round(((c.sent + c.failed) / c.total) * 100) : 0; return <tr key={c.id}><td className="font-medium">{c.name}<p className="line-clamp-1 max-w-xs text-xs font-normal text-slate-400">{c.body}</p></td><td className="num text-xs">{formatJalaliDateTime(c.createdAt)}</td><td className="num">{toPersianDigits(c.total)}</td><td className="num text-sage-700">{toPersianDigits(c.sent)}</td><td className="num text-coral-600">{toPersianDigits(c.failed)}</td><td><div className="flex items-center gap-2"><div className="h-2 w-24 rounded-full bg-sand-200"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div><span className="num text-xs">{toPersianDigits(pct)}٪</span></div></td><td className="text-xs">{c.createdBy ? `${c.createdBy.firstName} ${c.createdBy.lastName}` : "-"}</td></tr>; })}</tbody></table>
      ) : <EmptyState title="کمپینی ارسال نشده" />}
    </Card>
  );
}

function Logs() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["sms-logs", q, status, page], queryFn: () => api.get<any>("/sms/logs", { q, status, page }), placeholderData: (p) => p });
  return (
    <>
      <Card className="mb-4"><div className="grid gap-3 md:grid-cols-3"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="شماره یا متن..." className="md:col-span-2" /><Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">همه وضعیت‌ها</option><option value="SENT">ارسال‌شده</option><option value="FAILED">ناموفق</option><option value="MOCK">آزمایشی</option><option value="PENDING">در انتظار</option></Select></div></Card>
      <Card padded={false} className="overflow-x-auto">
        {isLoading && !data ? <Spinner /> : data?.items.length ? (
          <table className="table"><thead><tr><th>زمان</th><th>گیرنده</th><th>الگو</th><th>متن</th><th>وضعیت</th><th>خطا</th></tr></thead>
            <tbody>{data.items.map((l: any) => <tr key={l.id}><td className="num text-xs">{formatJalaliDateTime(l.createdAt)}</td><td className="num text-xs" dir="ltr">{toPersianDigits(l.to)}</td><td className="num text-xs">{l.templateKey ?? "-"}</td><td className="max-w-md text-xs"><p className="line-clamp-2 whitespace-pre-wrap">{l.body}</p></td><td><StatusBadge status={l.status} /></td><td className="max-w-[160px] truncate text-xs text-coral-600">{l.error ?? ""}</td></tr>)}</tbody></table>
        ) : <EmptyState title="پیامکی ثبت نشده" />}
      </Card>
      {data && data.total > data.pageSize && <div className="mt-4 flex items-center justify-center gap-2 text-sm"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</Button><span className="num">صفحه {toPersianDigits(page)} از {toPersianDigits(Math.ceil(data.total / data.pageSize))}</span><Button variant="secondary" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>بعدی</Button></div>}
    </>
  );
}

export default function SmsPage() {
  return <Suspense><Inner /></Suspense>;
}
