"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings, Save, Send, Building2, Globe, CalendarDays, Wallet, Users, MessageSquareText, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, Textarea, Toggle } from "@/components/ui";
import { BackupsCard } from "@/components/settings/BackupsCard";

const ICONS: Record<string, any> = { clinic: Building2, public: Globe, schedule: CalendarDays, finance: Wallet, crm: Users, sms: MessageSquareText, security: ShieldCheck, general: Settings, booking: CalendarDays, payment: Wallet, consent: ShieldCheck };

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: () => api.get<{ items: any[]; groups: Record<string, string> }>("/settings") });
  const [values, setValues] = useState<Record<string, string>>({});
  const [group, setGroup] = useState("clinic");
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  useEffect(() => { if (data) setValues(Object.fromEntries(data.items.map((i) => [i.key, i.value]))); }, [data]);
  if (isLoading || !data) return <Spinner />;
  const groups = Object.keys(data.groups).filter((g) => data.items.some((i) => i.group === g));
  const dirty = data.items.filter((i) => values[i.key] !== undefined && values[i.key] !== i.value);
  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", { values: Object.fromEntries(dirty.map((i) => [i.key, values[i.key]])) });
      toast.success("تنظیمات ذخیره شد");
      qc.invalidateQueries({ queryKey: ["settings"] }); qc.invalidateQueries({ queryKey: ["public-settings"] });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  const sendTest = async () => { try { const r = await api.post<{ log: any }>("/settings/sms-test", { to: testTo }); toast[r.log.status === "FAILED" ? "error" : "success"](r.log.status === "FAILED" ? `ناموفق: ${r.log.error}` : `وضعیت: ${r.log.status}`); } catch (e: any) { toast.error(e.message); } };
  const Icon = ICONS[group] ?? Settings;
  return (
    <>
      <PageHeader title="تنظیمات" subtitle="همه تنظیمات در دیتابیس ذخیره می‌شوند و بدون تغییر کد قابل ویرایش‌اند" icon={<Settings className="h-5 w-5" />} actions={<Button loading={saving} disabled={!dirty.length} onClick={save} icon={<Save className="h-4 w-4" />}>ذخیره تغییرات{dirty.length ? ` (${dirty.length})` : ""}</Button>} />
      <Tabs value={group} onChange={setGroup} className="mb-5" tabs={groups.map((g) => ({ key: g, label: data.groups[g] }))} />
      <Card title={<span className="flex items-center gap-2"><Icon className="h-5 w-5 text-brand-600" />{data.groups[group]}</span>} actions={group === "sms" && <Button variant="secondary" size="sm" onClick={() => setTestOpen(true)} icon={<Send className="h-4 w-4" />}>ارسال پیامک آزمایشی</Button>}>
        {group === "sms" && (
          <div className="mb-5 rounded-2xl bg-brand-50 p-4 text-sm leading-7 text-brand-900">
            <p className="font-bold">راهنمای اتصال ملی‌پیامک</p>
            <ul className="mr-4 list-disc text-xs leading-6">
              <li><b>melipayamak-rest</b>: نام کاربری و رمز پنل + شماره فرستنده (خط اختصاصی).</li>
              <li><b>melipayamak-console</b>: کلید API از کنسول جدید ملی‌پیامک + شماره فرستنده.</li>
              <li>برای ارسال خدماتی با الگوهای تأییدشده، کد هر الگو (bodyId) را در بخش «پیامک ← الگوها» وارد و «استفاده از الگوها» را فعال کنید.</li>
              <li>در حالت <b>mock</b> هیچ پیامکی ارسال نمی‌شود و متن در گزارش ارسال ثبت می‌گردد (مناسب تست).</li>
            </ul>
          </div>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          {data.items.filter((i) => i.group === group).map((i) => {
            const val = values[i.key] ?? "";
            const set = (v: string) => setValues({ ...values, [i.key]: v });
            const wide = i.type === "textarea" || i.type === "json";
            return (
              <Field key={i.key} label={i.label ?? i.key} hint={i.description} className={wide ? "md:col-span-2" : ""}>
                {i.type === "boolean" ? <Toggle checked={val === "true"} onChange={(c) => set(c ? "true" : "false")} label={val === "true" ? "فعال" : "غیرفعال"} />
                  : i.type === "select" ? <Select value={val} onChange={(e) => set(e.target.value)}>{(i.options ?? []).map((o: string) => <option key={o} value={o}>{o}</option>)}</Select>
                  : i.type === "textarea" ? <Textarea value={val} onChange={(e) => set(e.target.value)} />
                  : i.type === "json" ? <Textarea value={val} onChange={(e) => set(e.target.value)} dir="ltr" className="num min-h-[160px] text-xs" />
                  : <Input type={i.type === "password" ? "password" : i.type === "number" ? "number" : "text"} value={val} onChange={(e) => set(e.target.value)} dir={i.type === "number" || i.type === "password" || /url|phone|mobile|instagram|username|from|apiKey/i.test(i.key) ? "ltr" : "rtl"} className={i.type === "number" ? "num" : ""} placeholder={i.secret ? "برای تغییر، مقدار جدید را وارد کنید" : ""} />}
              </Field>
            );
          })}
        </div>
      </Card>
      {group === "security" && <BackupsCard />}
      {group === "payment" && <p className="mt-3 text-xs leading-6 text-slate-500">برای دریافت مرچنت زرین‌پال در zarinpal.com ثبت‌نام و درگاه بسازید. تا زمانی که «حالت آزمایشی» فعال است، تراکنش‌ها در محیط sandbox انجام می‌شود و پول واقعی جابه‌جا نمی‌شود. «آدرس سایت» در بخش سایت عمومی باید آدرس واقعی (https) باشد تا بازگشت از درگاه کار کند.</p>}
      <Modal open={testOpen} onClose={() => setTestOpen(false)} title="پیامک آزمایشی" size="sm" footer={<><Button variant="secondary" onClick={() => setTestOpen(false)}>بستن</Button><Button onClick={sendTest} icon={<Send className="h-4 w-4" />}>ارسال</Button></>}>
        <p className="mb-3 text-xs text-slate-500">ابتدا تنظیمات را ذخیره کنید، سپس با تنظیمات ذخیره‌شده پیامک آزمایشی ارسال می‌شود.</p>
        <Field label="شماره گیرنده"><Input value={testTo} onChange={(e) => setTestTo(e.target.value)} dir="ltr" className="num text-left" placeholder="09123456789" /></Field>
      </Modal>
    </>
  );
}
