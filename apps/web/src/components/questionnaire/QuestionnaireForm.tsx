"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Send, Info, LogIn } from "lucide-react";
import { toPersianDigits, type QuestionnaireDef } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

type Answers = Record<string, number>;

/**
 * فرم تکمیل پرسشنامه (پروفایل حسی و ...)؛ هم در سایت عمومی و هم در پنل مراجع.
 * مراجع وارد شده: پاسخ در پرونده خودش ثبت می‌شود. مهمان: نام، موبایل و نام کودک لازم است.
 * پاسخ‌ها تا ارسال، در همین مرورگر نگه داشته می‌شوند تا با بستن صفحه از دست نروند.
 */
export function QuestionnaireForm({ def, responseId, onDone, loginHref }: { def: QuestionnaireDef; responseId?: string; onDone?: () => void; loginHref?: string }) {
  const { user, loading: authLoading } = useAuth();
  const member = user?.role === "PATIENT";
  const draftKey = `q-draft:${def.type}:${responseId ?? "new"}`;
  const [answers, setAnswers] = useState<Answers>({});
  const [info, setInfo] = useState({ respondentName: "", respondentPhone: "", subjectName: "", subjectAge: "" });
  const [missing, setMissing] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) { const d = JSON.parse(raw); if (d.answers) setAnswers(d.answers); if (d.info) setInfo((v) => ({ ...v, ...d.info })); }
    } catch { /* ذخیره موقت در دسترس نیست */ }
    loaded.current = true;
  }, [draftKey]);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ answers, info })); } catch { /* ignore */ }
  }, [answers, info, draftKey]);
  useEffect(() => {
    if (member && user) setInfo((v) => ({ ...v, respondentName: v.respondentName || `${user.firstName} ${user.lastName}` }));
  }, [member, user]);

  const allNos = useMemo(() => def.sections.flatMap((s) => s.items.map((i) => i.no)), [def]);
  const answered = allNos.filter((n) => typeof answers[String(n)] === "number").length;
  const pct = Math.round((answered / allNos.length) * 100);

  const pick = (no: number, v: number) => {
    setAnswers((a) => ({ ...a, [String(no)]: v }));
    if (missing.includes(no)) setMissing((m) => m.filter((x) => x !== no));
  };

  const submit = async () => {
    const miss = allNos.filter((n) => typeof answers[String(n)] !== "number");
    if (miss.length) {
      setMissing(miss);
      toast.error(`${toPersianDigits(miss.length)} سؤال هنوز پاسخ داده نشده است`);
      document.getElementById(`q-${miss[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!member) {
      if (info.respondentName.trim().length < 2) return toast.error("نام و نام خانوادگی خود را بنویسید");
      if (!/^0?9\d{9}$/.test(info.respondentPhone.replace(/[^\d]/g, ""))) return toast.error("شماره موبایل معتبر وارد کنید");
      if (!info.subjectName.trim()) return toast.error("نام کودک را بنویسید");
    }
    setSending(true);
    try {
      await api.post(`/questionnaires/submit/${def.type}`, { answers, ...info, responseId });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      onDone?.();
    } catch (e: any) { toast.error(e.message); } finally { setSending(false); }
  };

  if (done) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-sage-600" />
        <h2 className="mt-4 text-xl font-black text-brand-900">پاسخ‌ها با موفقیت ثبت شد</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-600">
          {member ? "پرسشنامه در پرونده شما ثبت شد و برای کاردرمانگر ارسال شد. پس از بررسی، نتیجه در بخش «پرسشنامه‌ها» پنل شما نمایش داده می‌شود." : "پاسخ‌ها برای کاردرمانگر کلینیک ارسال شد. پس از بررسی، همکاران ما برای توضیح نتیجه و در صورت نیاز تعیین وقت ارزیابی با شما تماس می‌گیرند."}
        </p>
        <p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-slate-400">این پرسشنامه به‌تنهایی تشخیص‌دهنده نیست و نتیجه آن باید در کنار سایر اطلاعات رشد و عملکرد کودک توسط متخصص تفسیر شود.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {member ? <Link href="/panel/my/questionnaires" className="btn-primary">پرسشنامه‌های من</Link> : <Link href="/book" className="btn-primary">درخواست نوبت ارزیابی</Link>}
          <Link href="/" className="btn-secondary">صفحه اصلی</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!authLoading && !member && (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-brand-900">مشخصات</h2>
            {loginHref && <Link href={loginHref} className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><LogIn className="h-4 w-4" />مراجع کلینیک هستید؟ وارد شوید تا در پرونده‌تان ثبت شود</Link>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نام و نام خانوادگی تکمیل‌کننده (والد/مراقب)" required><Input value={info.respondentName} onChange={(e) => setInfo({ ...info, respondentName: e.target.value })} autoComplete="name" /></Field>
            <Field label="شماره موبایل" required hint="برای اعلام نتیجه و هماهنگی با شما"><Input value={info.respondentPhone} onChange={(e) => setInfo({ ...info, respondentPhone: e.target.value })} dir="ltr" inputMode="tel" className="num text-left" placeholder="09xxxxxxxxx" autoComplete="tel" /></Field>
            <Field label="نام کودک" required><Input value={info.subjectName} onChange={(e) => setInfo({ ...info, subjectName: e.target.value })} /></Field>
            <Field label="سن کودک"><Input value={info.subjectAge} onChange={(e) => setInfo({ ...info, subjectAge: e.target.value })} placeholder="مثلاً ۵ سال و ۳ ماه" /></Field>
          </div>
        </div>
      )}
      {member && (
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <Field label="نام کودک (اگر پرسشنامه برای فرزندتان است)"><Input value={info.subjectName} onChange={(e) => setInfo({ ...info, subjectName: e.target.value })} /></Field>
          <Field label="سن کودک"><Input value={info.subjectAge} onChange={(e) => setInfo({ ...info, subjectAge: e.target.value })} placeholder="مثلاً ۵ سال و ۳ ماه" /></Field>
        </div>
      )}

      <div className="card p-4 text-xs leading-6 text-slate-600">
        <p className="flex items-start gap-1.5"><Info className="mt-1 h-4 w-4 shrink-0 text-brand-600" />{def.respondentHint} برای هر جمله، گزینه‌ای را انتخاب کنید که بیشتر با رفتار معمول کودک مطابقت دارد.</p>
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
          {def.scale.map((sc) => <div key={sc.value} className="rounded-lg bg-sand-100 px-2 py-1.5 text-center"><b className="block text-slate-700">{sc.label}</b><span className="text-[10px] text-slate-500">{sc.hint}</span></div>)}
        </div>
      </div>

      <div className="sticky top-2 z-20 rounded-2xl border border-sand-200 bg-white/95 px-4 py-3 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-slate-600"><span className="num">{toPersianDigits(answered)}</span> از <span className="num">{toPersianDigits(allNos.length)}</span> سؤال</span>
          <span className="num font-bold text-brand-700">{toPersianDigits(pct)}٪</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-200"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      {def.sections.map((sec) => (
        <section key={sec.key} className="card overflow-hidden">
          <h2 className="border-b border-sand-200 bg-brand-50 px-5 py-3 font-bold text-brand-900">{sec.title}</h2>
          <ol className="divide-y divide-sand-100">
            {sec.items.map((it) => {
              const val = answers[String(it.no)];
              const isMissing = missing.includes(it.no);
              return (
                <li key={it.no} id={`q-${it.no}`} className={cn("px-4 py-4 sm:px-5", isMissing && "bg-coral-500/10")}>
                  <p className="text-sm leading-7 text-slate-800"><span className="num ml-1.5 inline-grid h-6 min-w-6 place-items-center rounded-full bg-sand-200 px-1.5 text-xs font-bold text-slate-600">{toPersianDigits(it.no)}</span>{it.text}</p>
                  <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6" role="radiogroup" aria-label={`سؤال ${it.no}`}>
                    {def.scale.map((sc) => (
                      <button key={sc.value} type="button" role="radio" aria-checked={val === sc.value} onClick={() => pick(it.no, sc.value)} className={cn("rounded-xl border px-1 py-2 text-[11px] font-medium leading-4 transition sm:text-xs", val === sc.value ? "border-brand-600 bg-brand-600 text-white shadow-sm" : "border-sand-300 bg-white text-slate-600 hover:border-brand-400")}>
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <div className="card flex flex-col items-center gap-3 p-5 text-center">
        <p className="text-xs leading-6 text-slate-500">با ارسال، پاسخ‌ها برای کاردرمانگر کلینیک فرستاده می‌شود. این پرسشنامه به‌تنهایی تشخیص‌دهنده نیست.</p>
        <Button size="lg" loading={sending} onClick={submit} icon={<Send className="h-4 w-4" />}>ارسال پاسخ‌ها</Button>
      </div>
    </div>
  );
}
