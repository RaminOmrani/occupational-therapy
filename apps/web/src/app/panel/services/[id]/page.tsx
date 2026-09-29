"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Stethoscope, Save, Upload, Eye, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Field, Input, PageHeader, Select, Textarea, Toggle } from "@/components/ui";
import { RichEditor } from "@/components/editor/RichEditor";
import { toPersianDigits } from "@toranj/shared";

const ICON_OPTIONS = [["activity", "فعالیت / حرکتی"], ["brain", "مغز / شناختی"], ["sparkles", "حسی"], ["heart-pulse", "قلب / عصبی"], ["home", "خانه / روزمره"], ["clipboard-check", "ارزیابی"]];
const EMPTY = { title: "", slug: "", shortDescription: "", content: "", audience: "", process: "", faq: [] as { q: string; a: string }[], icon: "activity", coverImage: "", seoTitle: "", seoDescription: "", keywords: "", sortOrder: 0, published: true };

export default function ServiceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [v, setV] = useState({ ...EMPTY });
  const [ready, setReady] = useState(isNew);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isNew) return;
    api.get<{ service: any }>(`/services/${id}`).then(({ service: s }) => { setV({ ...EMPTY, ...s, shortDescription: s.shortDescription ?? "", audience: s.audience ?? "", process: s.process ?? "", icon: s.icon ?? "activity", coverImage: s.coverImage ?? "", seoTitle: s.seoTitle ?? "", seoDescription: s.seoDescription ?? "", keywords: (s.keywords ?? []).join(", ") }); setReady(true); }).catch((e) => toast.error(e.message));
  }, [id, isNew]);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const fd = new FormData(); fd.append("file", f); setBusy(true); try { const r = await api.post<{ url: string }>("/uploads", fd); setV((s) => ({ ...s, coverImage: r.url })); } catch (err: any) { toast.error(err.message); } finally { setBusy(false); } };
  const save = async (publish?: boolean) => {
    if (!v.title.trim()) return toast.error("عنوان را وارد کنید");
    setLoading(true);
    try {
      const payload = { ...v, slug: v.slug || undefined, keywords: v.keywords || undefined, sortOrder: Number(v.sortOrder || 0), published: publish ?? v.published, faq: v.faq.filter((f) => f.q.trim() && f.a.trim()) };
      const r = isNew ? await api.post<{ service: any }>("/services", payload) : await api.patch<{ service: any }>(`/services/${id}`, payload);
      toast.success("ذخیره شد");
      if (isNew) router.replace(`/panel/services/${r.service.id}`); else setV((s) => ({ ...s, slug: r.service.slug, published: r.service.published }));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  if (!ready) return null;
  const setFaq = (i: number, k: "q" | "a", val: string) => setV({ ...v, faq: v.faq.map((f, j) => (j === i ? { ...f, [k]: val } : f)) });
  return (
    <>
      <PageHeader title={isNew ? "خدمت جدید" : `ویرایش: ${v.title}`} subtitle="این محتوا در صفحه عمومی خدمت و در نتایج گوگل نمایش داده می‌شود" icon={<Stethoscope className="h-5 w-5" />} actions={<>
        {!isNew && v.published && v.slug && <a href={`/services/${v.slug}`} target="_blank" className="btn-secondary"><ExternalLink className="h-4 w-4" />مشاهده</a>}
        <Button variant="secondary" loading={loading} onClick={() => save(false)} icon={<Save className="h-4 w-4" />}>ذخیره پیش‌نویس</Button>
        <Button loading={loading} onClick={() => save(true)} icon={<Eye className="h-4 w-4" />}>ذخیره و انتشار</Button>
      </>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <Field label="عنوان خدمت" required hint="مثلاً «توان‌بخشی جسمی»؛ نام شهر خودکار به تیتر صفحه اضافه می‌شود"><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="text-lg font-bold" autoFocus /></Field>
            <Field label="توضیح کوتاه" hint="یک تا دو جمله؛ در کارت‌ها و زیر تیتر" className="mt-3"><Textarea value={v.shortDescription} onChange={(e) => setV({ ...v, shortDescription: e.target.value })} className="min-h-[60px]" /></Field>
          </Card>
          <Card title="توضیح خدمت" subtitle="این خدمت چیست و چگونه انجام می‌شود (بدون ادعای درمان قطعی)"><RichEditor value={v.content} onChange={(html) => setV((s) => ({ ...s, content: html }))} minHeight={260} /></Card>
          <Card title="برای چه کسانی مناسب است؟" subtitle="فهرست گروه‌های هدف"><RichEditor value={v.audience} onChange={(html) => setV((s) => ({ ...s, audience: html }))} minHeight={140} placeholder="مثلاً: کودکان با تأخیر رشد حرکتی…" /></Card>
          <Card title="روند جلسه‌ها" subtitle="مراحل از ارزیابی تا پیگیری"><RichEditor value={v.process} onChange={(html) => setV((s) => ({ ...s, process: html }))} minHeight={140} placeholder="۱. جلسه ارزیابی اولیه… ۲. …" /></Card>
          <Card title="پرسش‌های متداول" subtitle="فقط پرسش‌هایی که واقعاً مراجعین می‌پرسند؛ در گوگل به‌صورت FAQ نمایش داده می‌شود" actions={<Button size="sm" variant="secondary" onClick={() => setV({ ...v, faq: [...v.faq, { q: "", a: "" }] })} icon={<Plus className="h-4 w-4" />}>افزودن پرسش</Button>}>
            <div className="space-y-3">
              {v.faq.map((f, i) => (
                <div key={i} className="rounded-2xl bg-sand-100 p-3">
                  <div className="flex items-center gap-2"><span className="num text-xs text-slate-400">{toPersianDigits(i + 1)}</span><Input value={f.q} onChange={(e) => setFaq(i, "q", e.target.value)} placeholder="پرسش" className="flex-1 font-bold" /><button onClick={() => setV({ ...v, faq: v.faq.filter((_, j) => j !== i) })} className="rounded-lg p-2 text-slate-400 hover:text-coral-600"><Trash2 className="h-4 w-4" /></button></div>
                  <Textarea value={f.a} onChange={(e) => setFaq(i, "a", e.target.value)} placeholder="پاسخ کوتاه و دقیق" className="mt-2 min-h-[60px]" />
                </div>
              ))}
              {!v.faq.length && <p className="text-xs text-slate-400">هنوز پرسشی اضافه نشده.</p>}
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="انتشار">
            <Toggle checked={v.published} onChange={(c) => setV({ ...v, published: c })} label="منتشر شود" description="در سایت، منو، فوتر و نقشه سایت" />
            <Field label="نامک (آدرس انگلیسی)" hint="مثلاً speech-therapy-mashhad؛ خالی = خودکار" className="mt-3"><Input value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value.toLowerCase() })} dir="ltr" /></Field>
            <Field label="ترتیب نمایش" className="mt-3"><Input type="number" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) })} className="num w-24" dir="ltr" /></Field>
            <Field label="آیکون" className="mt-3"><Select value={v.icon} onChange={(e) => setV({ ...v, icon: e.target.value })}>{ICON_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          </Card>
          <Card title="سئو (گوگل)" subtitle="اگر خالی بماند از عنوان و توضیح کوتاه ساخته می‌شود">
            <Field label="عنوان در گوگل (title)" hint={`${toPersianDigits(v.seoTitle.length)} حرف؛ بهتر است زیر ۶۰ باشد و کلیدواژه + شهر داشته باشد`}><Input value={v.seoTitle} onChange={(e) => setV({ ...v, seoTitle: e.target.value })} placeholder="گفتاردرمانی در مشهد | کلینیک ذهن سبز" /></Field>
            <Field label="توضیح در گوگل (description)" hint={`${toPersianDigits(v.seoDescription.length)} حرف؛ حدود ۱۵۰ تا ۱۶۰`} className="mt-3"><Textarea value={v.seoDescription} onChange={(e) => setV({ ...v, seoDescription: e.target.value })} className="min-h-[80px]" /></Field>
            <Field label="کلیدواژه‌ها" hint="با ویرگول" className="mt-3"><Input value={v.keywords} onChange={(e) => setV({ ...v, keywords: e.target.value })} /></Field>
          </Card>
          <Card title="تصویر شاخص" subtitle="در بالای صفحه و هنگام اشتراک‌گذاری">
            {v.coverImage && <img src={v.coverImage} alt="" className="mb-3 h-36 w-full rounded-xl object-cover" />}
            <label className="btn-secondary w-full cursor-pointer">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}بارگذاری تصویر<input type="file" accept="image/*" className="hidden" onChange={upload} /></label>
            {v.coverImage && <button onClick={() => setV({ ...v, coverImage: "" })} className="mt-2 text-xs text-coral-600">حذف تصویر</button>}
          </Card>
        </div>
      </div>
    </>
  );
}
