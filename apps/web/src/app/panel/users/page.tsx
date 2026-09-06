"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCog, Plus, Pencil, ShieldCheck, History } from "lucide-react";
import { ROLES, ROLE_LABELS, WEEKDAYS_FA, formatJalali, formatJalaliDateTime, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, Textarea, Toggle } from "@/components/ui";
import { cn } from "@/lib/utils";

const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
const COLORS = ["#0f8b8d", "#e76f51", "#f4a261", "#8b5cf6", "#7ba874", "#0ea5e9", "#ec4899", "#64748b"];

export default function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [edit, setEdit] = useState<any | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => api.get<{ items: any[] }>("/users") });
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => api.get<{ items: any[] }>("/users/audit"), enabled: tab === "audit" });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["therapists"] }); };
  return (
    <>
      <PageHeader title="کاربران و درمانگران" subtitle="مدیریت دسترسی همکاران کلینیک" icon={<UserCog className="h-5 w-5" />} actions={<Button onClick={() => setEdit({ role: "THERAPIST", isActive: true, therapist: { workDays: [6, 0, 1, 2, 3], color: COLORS[0], isPublic: true } })} icon={<Plus className="h-4 w-4" />}>کاربر جدید</Button>} />
      <Tabs value={tab} onChange={setTab} className="mb-5" tabs={[{ key: "users", label: "کاربران" }, { key: "audit", label: <span className="flex items-center gap-1"><History className="h-4 w-4" />گزارش فعالیت</span> }]} />
      {tab === "users" && (isLoading ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.items.map((u) => (
            <Card key={u.id} className={cn("flex gap-4", !u.isActive && "opacity-60")}>
              <Avatar name={u.fullName} size="lg" className={u.therapist ? "ring-2 ring-offset-2" : ""} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><h3 className="truncate font-bold">{u.fullName}</h3><button onClick={() => setEdit({ ...u, therapist: u.therapist ?? { workDays: [6, 0, 1, 2, 3], color: COLORS[0], isPublic: true } })} className="text-slate-400 hover:text-brand-600"><Pencil className="h-4 w-4" /></button></div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5"><Badge tone={u.role === "ADMIN" ? "coral" : u.role === "THERAPIST" ? "brand" : "amber"}>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}</Badge>{!u.isActive && <Badge tone="slate">غیرفعال</Badge>}{u.id === me?.id && <Badge tone="sage"><ShieldCheck className="h-3 w-3" />شما</Badge>}</div>
                <p className="num mt-2 text-xs text-slate-500" dir="ltr">{toPersianDigits(u.phone)}</p>
                {u.therapist && <p className="mt-1 text-xs text-slate-500">{u.therapist.specialty}</p>}
                {u.therapist && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><span className="h-2.5 w-2.5 rounded-full" style={{ background: u.therapist.color }} />{WEEK_ORDER.filter((d) => u.therapist.workDays.includes(d)).map((d) => WEEKDAYS_FA[d].slice(0, 1)).join(" ")}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{u.lastLoginAt ? `آخرین ورود: ${formatJalali(u.lastLoginAt)}` : "هنوز وارد نشده"}</p>
              </div>
            </Card>
          ))}
        </div>
      ))}
      {tab === "audit" && (audit.isLoading ? <Spinner /> : (
        <Card padded={false} className="overflow-x-auto">
          {audit.data?.items.length ? <table className="table"><thead><tr><th>زمان</th><th>کاربر</th><th>عمل</th><th>موجودیت</th><th>جزئیات</th></tr></thead><tbody>{audit.data.items.map((a) => <tr key={a.id}><td className="num text-xs">{formatJalaliDateTime(a.createdAt)}</td><td className="text-xs">{a.user ? `${a.user.firstName} ${a.user.lastName}` : "-"}</td><td className="num text-xs">{a.action}</td><td className="num text-xs">{a.entity}</td><td className="max-w-xs truncate text-[11px] text-slate-400" dir="ltr">{a.meta ?? ""}</td></tr>)}</tbody></table> : <EmptyState title="فعالیتی ثبت نشده" />}
        </Card>
      ))}
      {edit && <UserModal initial={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); refresh(); }} />}
    </>
  );
}

function UserModal({ initial, onClose, onDone }: { initial: any; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ firstName: initial.firstName ?? "", lastName: initial.lastName ?? "", phone: initial.phone ?? "", role: initial.role ?? "THERAPIST", password: "", isActive: initial.isActive ?? true, therapist: { specialty: initial.therapist?.specialty ?? "", bio: initial.therapist?.bio ?? "", licenseNo: initial.therapist?.licenseNo ?? "", color: initial.therapist?.color ?? COLORS[0], isPublic: initial.therapist?.isPublic ?? true, sessionPrice: initial.therapist?.sessionPrice ?? "", workDays: initial.therapist?.workDays ?? [6, 0, 1, 2, 3], sortOrder: initial.therapist?.sortOrder ?? 0 } });
  const [loading, setLoading] = useState(false);
  const t = v.therapist;
  const setT = (k: string, val: any) => setV({ ...v, therapist: { ...t, [k]: val } });
  const save = async () => {
    setLoading(true);
    try {
      const payload: any = { ...v, password: v.password || undefined, therapist: v.role === "THERAPIST" ? { ...t, sessionPrice: t.sessionPrice ? Number(t.sessionPrice) : null, sortOrder: Number(t.sortOrder || 0) } : undefined };
      if (initial.id) await api.patch(`/users/${initial.id}`, payload); else await api.post("/users", payload);
      toast.success("ذخیره شد"); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  return (
    <Modal open onClose={onClose} title={initial.id ? `ویرایش ${initial.fullName}` : "کاربر جدید"} size="lg" footer={<><Button variant="secondary" onClick={onClose}>انصراف</Button><Button loading={loading} onClick={save}>ذخیره</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام" required><Input value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} autoFocus /></Field>
        <Field label="نام خانوادگی" required><Input value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} /></Field>
        <Field label="موبایل (نام کاربری)" required><Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} dir="ltr" className="num text-left" /></Field>
        <Field label="نقش"><Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>{ROLES.filter((r) => r !== "PATIENT").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select></Field>
        <Field label={initial.id ? "رمز عبور جدید (اختیاری)" : "رمز عبور"} required={!initial.id}><Input type="password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} dir="ltr" /></Field>
        <div className="flex items-end pb-2"><Toggle checked={v.isActive} onChange={(c) => setV({ ...v, isActive: c })} label="فعال" /></div>
        {v.role === "THERAPIST" && (
          <>
            <div className="sm:col-span-2 mt-2 border-t border-sand-200 pt-4 text-sm font-bold text-brand-800">اطلاعات درمانگر</div>
            <Field label="تخصص"><Input value={t.specialty} onChange={(e) => setT("specialty", e.target.value)} /></Field>
            <Field label="شماره نظام / پروانه"><Input value={t.licenseNo} onChange={(e) => setT("licenseNo", e.target.value)} /></Field>
            <Field label="قیمت پیش‌فرض جلسه (تومان)"><Input value={t.sessionPrice} onChange={(e) => setT("sessionPrice", e.target.value)} className="num" dir="ltr" /></Field>
            <Field label="ترتیب نمایش"><Input type="number" value={t.sortOrder} onChange={(e) => setT("sortOrder", e.target.value)} className="num" dir="ltr" /></Field>
            <Field label="رنگ در تقویم"><div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} type="button" onClick={() => setT("color", c)} className={cn("h-8 w-8 rounded-full ring-offset-2 transition", t.color === c && "ring-2 ring-slate-500")} style={{ background: c }} />)}</div></Field>
            <Field label="روزهای کاری"><div className="flex flex-wrap gap-1">{WEEK_ORDER.map((d) => <button key={d} type="button" onClick={() => setT("workDays", t.workDays.includes(d) ? t.workDays.filter((x: number) => x !== d) : [...t.workDays, d])} className={cn("rounded-lg border px-2.5 py-1.5 text-xs", t.workDays.includes(d) ? "border-brand-600 bg-brand-600 text-white" : "border-sand-300")}>{WEEKDAYS_FA[d]}</button>)}</div></Field>
            <Field label="معرفی (نمایش در سایت)" className="sm:col-span-2"><Textarea value={t.bio} onChange={(e) => setT("bio", e.target.value)} className="min-h-[70px]" /></Field>
            <div className="sm:col-span-2"><Toggle checked={t.isPublic} onChange={(c) => setT("isPublic", c)} label="نمایش در صفحه عمومی سایت" /></div>
          </>
        )}
      </div>
    </Modal>
  );
}
