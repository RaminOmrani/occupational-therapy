"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Newspaper, Save, Upload, Eye, Video, Mic, BookOpen, FileText, Loader2, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Field, Input, PageHeader, Select, Textarea, Toggle } from "@/components/ui";
import { RichEditor, toEmbed } from "@/components/editor/RichEditor";
import { cn } from "@/lib/utils";

const CONTENT_TYPE_META: Record<string, { label: string; icon: any; hint: string }> = {
  ARTICLE: { label: "مقاله", icon: FileText, hint: "متن آموزشی با تصویر، جدول و لینک" },
  VIDEO: { label: "ویدیو", icon: Video, hint: "لینک آپارات/یوتیوب یا فایل ویدیویی" },
  PODCAST: { label: "پادکست", icon: Mic, hint: "فایل صوتی به‌همراه توضیحات" },
  BOOK: { label: "کتاب", icon: BookOpen, hint: "معرفی کتاب با فایل PDF یا لینک تهیه" },
};

const EMPTY = { title: "", excerpt: "", content: "", coverImage: "", category: "", tags: "", published: false, featured: false, slug: "", type: "ARTICLE", format: "html", mediaUrl: "", embedUrl: "", fileUrl: "", externalUrl: "", duration: "", authorLabel: "", sourceName: "" };

export default function ContentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [v, setV] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState(isNew);
  useEffect(() => {
    if (isNew) return;
    api.get<{ article: any }>(`/articles/${id}`).then(({ article: a }) => {
      // مقالات قدیمی Markdown هستند؛ برای ویرایش در ویرایشگر جدید به پاراگراف HTML تبدیل می‌شوند
      const content = a.format === "markdown" ? a.content.split(/\n{2,}/).map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("") : a.content;
      setV({ ...EMPTY, title: a.title, excerpt: a.excerpt ?? "", content, coverImage: a.coverImage ?? "", category: a.category ?? "", tags: a.tags.join("، "), published: a.published, featured: a.featured, slug: a.slug, type: a.type, format: "html", mediaUrl: a.mediaUrl ?? "", embedUrl: a.embedUrl ?? "", fileUrl: a.fileUrl ?? "", externalUrl: a.externalUrl ?? "", duration: a.duration ?? "", authorLabel: a.authorLabel ?? "", sourceName: a.sourceName ?? "" });
      setReady(true);
    }).catch((e) => toast.error(e.message));
  }, [id, isNew]);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>, key: "coverImage" | "mediaUrl" | "fileUrl") => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    setBusy(key);
    try { const r = await api.post<{ url: string }>(key === "coverImage" ? "/uploads" : "/uploads/media", fd); setV((s) => ({ ...s, [key]: r.url })); toast.success("فایل بارگذاری شد"); } catch (err: any) { toast.error(err.message); } finally { setBusy(null); }
  };
  const save = async (publish?: boolean) => {
    if (!v.title.trim()) return toast.error("عنوان را وارد کنید");
    setLoading(true);
    try {
      const payload = { ...v, tags: v.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean), published: publish ?? v.published, slug: v.slug || undefined };
      const r = isNew ? await api.post<{ article: any }>("/articles", payload) : await api.patch<{ article: any }>(`/articles/${id}`, payload);
      toast.success(payload.published ? "منتشر شد" : "ذخیره شد");
      if (isNew) router.replace(`/panel/articles/${r.article.id}`); else setV((s) => ({ ...s, published: r.article.published, slug: r.article.slug }));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  if (!ready) return null;
  const meta = CONTENT_TYPE_META[v.type] ?? CONTENT_TYPE_META.ARTICLE;
  const embed = v.embedUrl ? toEmbed(v.embedUrl) : null;

  return (
    <>
      <PageHeader title={isNew ? "محتوای جدید" : `ویرایش ${meta.label}`} subtitle={meta.hint} icon={<Newspaper className="h-5 w-5" />} actions={<>
        {v.published && v.slug && <a href={`/media/${encodeURIComponent(v.slug)}`} target="_blank" className="btn-secondary"><ExternalLink className="h-4 w-4" />مشاهده</a>}
        <Button variant="secondary" loading={loading} onClick={() => save(false)} icon={<Save className="h-4 w-4" />}>ذخیره پیش‌نویس</Button>
        <Button loading={loading} onClick={() => save(true)} icon={<Eye className="h-4 w-4" />}>ذخیره و انتشار</Button>
      </>} />

      <Card className="mb-5">
        <p className="mb-2 text-xs font-medium text-slate-500">نوع محتوا</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(CONTENT_TYPE_META).map(([k, m]) => (
            <button key={k} type="button" onClick={() => setV({ ...v, type: k })} className={cn("flex items-center gap-2 rounded-2xl border-2 p-3 text-sm font-bold transition", v.type === k ? "border-brand-600 bg-brand-50 text-brand-800" : "border-sand-200 bg-white text-slate-600 hover:border-brand-300")}><m.icon className="h-5 w-5" />{m.label}</button>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <Field label="عنوان" required><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="text-lg font-bold" autoFocus /></Field>
            <Field label="خلاصه" hint="در کارت‌ها و نتایج جستجو نمایش داده می‌شود" className="mt-3"><Textarea value={v.excerpt} onChange={(e) => setV({ ...v, excerpt: e.target.value })} className="min-h-[60px]" /></Field>
          </Card>

          {v.type === "VIDEO" && (
            <Card title="ویدیو" subtitle="یکی از دو روش: لینک آپارات/یوتیوب (پیشنهادی) یا آپلود فایل">
              <Field label="لینک ویدیو در آپارات یا یوتیوب"><Input value={v.embedUrl} onChange={(e) => setV({ ...v, embedUrl: e.target.value })} dir="ltr" placeholder="https://www.aparat.com/v/xxxxx" /></Field>
              {v.embedUrl && !embed && <p className="mt-1 text-xs text-coral-600">لینک شناخته نشد؛ لینک صفحه ویدیو در آپارات یا یوتیوب را بگذارید.</p>}
              {embed && <div className="media-embed mt-3"><iframe src={embed} allowFullScreen /></div>}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="btn-secondary cursor-pointer">{busy === "mediaUrl" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}آپلود فایل ویدیو (MP4)<input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => upload(e, "mediaUrl")} /></label>
                {v.mediaUrl && <a href={v.mediaUrl} target="_blank" className="text-xs text-brand-600 underline" dir="ltr">{v.mediaUrl}</a>}
                {v.mediaUrl && <button onClick={() => setV({ ...v, mediaUrl: "" })} className="text-xs text-coral-600">حذف فایل</button>}
              </div>
              <Field label="مدت" hint="مثلاً ۱۲:۳۰" className="mt-3"><Input value={v.duration} onChange={(e) => setV({ ...v, duration: e.target.value })} className="num w-40" /></Field>
            </Card>
          )}
          {v.type === "PODCAST" && (
            <Card title="فایل پادکست" subtitle="MP3 یا M4A؛ حداکثر ۳۰۰ مگابایت">
              <div className="flex flex-wrap items-center gap-3">
                <label className="btn-primary cursor-pointer">{busy === "mediaUrl" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}آپلود فایل صوتی<input type="file" accept="audio/*" className="hidden" onChange={(e) => upload(e, "mediaUrl")} /></label>
                <Input value={v.mediaUrl} onChange={(e) => setV({ ...v, mediaUrl: e.target.value })} dir="ltr" placeholder="یا لینک مستقیم فایل صوتی (مثلاً از کست‌باکس)" className="min-w-[240px] flex-1" />
              </div>
              {v.mediaUrl && <audio controls src={v.mediaUrl} className="mt-3 w-full" />}
              <Field label="مدت" hint="مثلاً ۲۴:۱۰" className="mt-3"><Input value={v.duration} onChange={(e) => setV({ ...v, duration: e.target.value })} className="num w-40" /></Field>
            </Card>
          )}
          {v.type === "BOOK" && (
            <Card title="فایل یا لینک کتاب" subtitle="PDF/ePub برای دانلود، یا لینک خرید/منبع">
              <div className="flex flex-wrap items-center gap-3">
                <label className="btn-secondary cursor-pointer">{busy === "fileUrl" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}آپلود PDF / ePub<input type="file" accept=".pdf,.epub" className="hidden" onChange={(e) => upload(e, "fileUrl")} /></label>
                {v.fileUrl && <a href={v.fileUrl} target="_blank" className="text-xs text-brand-600 underline" dir="ltr">{v.fileUrl}</a>}
                {v.fileUrl && <button onClick={() => setV({ ...v, fileUrl: "" })} className="text-xs text-coral-600">حذف فایل</button>}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="لینک خرید / منبع"><Input value={v.externalUrl} onChange={(e) => setV({ ...v, externalUrl: e.target.value })} dir="ltr" placeholder="https://" /></Field>
                <Field label="تعداد صفحات / سال نشر"><Input value={v.duration} onChange={(e) => setV({ ...v, duration: e.target.value })} className="num" placeholder="مثلاً ۲۱۰ صفحه، ۱۴۰۲" /></Field>
              </div>
            </Card>
          )}

          <Card title={v.type === "ARTICLE" ? "متن مقاله" : v.type === "BOOK" ? "معرفی و خلاصه کتاب" : "توضیحات و نکات"} subtitle="مثل Word: فونت، اندازه، رنگ، تراز، جدول، تصویر، ویدیو و لینک">
            <RichEditor value={v.content} onChange={(html) => setV((s) => ({ ...s, content: html }))} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="انتشار">
            <Toggle checked={v.published} onChange={(c) => setV({ ...v, published: c })} label="منتشر شود" description="در سایت عمومی نمایش داده می‌شود" />
            <div className="mt-3"><Toggle checked={v.featured} onChange={(c) => setV({ ...v, featured: c })} label="ویژه (در ابتدای فهرست)" /></div>
            <Field label="آدرس (slug)" hint="خالی = خودکار از عنوان" className="mt-3"><Input value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} dir="ltr" /></Field>
          </Card>
          <Card title="تصویر شاخص" subtitle={v.type === "BOOK" ? "جلد کتاب" : "در کارت و بالای صفحه"}>
            {v.coverImage && <img src={v.coverImage} alt="" className={cn("mb-3 w-full rounded-xl object-cover", v.type === "BOOK" ? "aspect-[3/4]" : "h-40")} />}
            <label className="btn-secondary w-full cursor-pointer">{busy === "coverImage" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}بارگذاری تصویر<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e, "coverImage")} /></label>
            <Field label="یا آدرس تصویر" className="mt-3"><Input value={v.coverImage} onChange={(e) => setV({ ...v, coverImage: e.target.value })} dir="ltr" /></Field>
          </Card>
          <Card title="نویسنده / منبع" subtitle="خالی = نام کاربر ثبت‌کننده (درمانگر)">
            <Field label={v.type === "PODCAST" ? "گوینده / تهیه‌کننده" : v.type === "BOOK" ? "نویسنده کتاب" : "نویسنده"} hint="برای محتوایی که از درمانگران کلینیک نیست"><Input value={v.authorLabel} onChange={(e) => setV({ ...v, authorLabel: e.target.value })} placeholder="مثلاً دکتر ..." /></Field>
            <Field label="نام منبع / ناشر" className="mt-3"><Input value={v.sourceName} onChange={(e) => setV({ ...v, sourceName: e.target.value })} placeholder="مثلاً انتشارات ارجمند، وب‌سایت ..." /></Field>
            {v.type !== "BOOK" && <Field label="لینک منبع اصلی" className="mt-3"><Input value={v.externalUrl} onChange={(e) => setV({ ...v, externalUrl: e.target.value })} dir="ltr" placeholder="https://" /></Field>}
          </Card>
          <Card title="دسته‌بندی">
            <Field label="دسته"><Input value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} placeholder="کودکان، بزرگسالان، اوتیسم، سکته مغزی..." /></Field>
            <Field label="برچسب‌ها" hint="با ویرگول جدا کنید" className="mt-3"><Input value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} /></Field>
          </Card>
        </div>
      </div>
    </>
  );
}
