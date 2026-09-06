"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Newspaper, Save, Upload, Eye, PenLine } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Field, Input, PageHeader, Tabs, Textarea, Toggle } from "@/components/ui";

export default function ArticleEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [v, setV] = useState({ title: "", excerpt: "", content: "", coverImage: "", category: "", tags: "", published: false, slug: "" });
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(isNew);
  useEffect(() => {
    if (isNew) return;
    api.get<{ article: any }>(`/articles/${id}`).then(({ article: a }) => { setV({ title: a.title, excerpt: a.excerpt ?? "", content: a.content, coverImage: a.coverImage ?? "", category: a.category ?? "", tags: a.tags.join("، "), published: a.published, slug: a.slug }); setReady(true); }).catch((e) => toast.error(e.message));
  }, [id, isNew]);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    try { const r = await api.post<{ url: string }>("/uploads", fd); setV({ ...v, coverImage: r.url }); toast.success("تصویر بارگذاری شد"); } catch (err: any) { toast.error(err.message); }
  };
  const save = async (publish?: boolean) => {
    setLoading(true);
    try {
      const payload = { ...v, tags: v.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean), published: publish ?? v.published, slug: v.slug || undefined };
      const r = isNew ? await api.post<{ article: any }>("/articles", payload) : await api.patch<{ article: any }>(`/articles/${id}`, payload);
      toast.success(payload.published ? "مقاله منتشر شد" : "ذخیره شد");
      if (isNew) router.replace(`/panel/articles/${r.article.id}`); else setV({ ...v, published: r.article.published, slug: r.article.slug });
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  if (!ready) return null;
  return (
    <>
      <PageHeader title={isNew ? "مقاله جدید" : "ویرایش مقاله"} icon={<Newspaper className="h-5 w-5" />} actions={<><Button variant="secondary" loading={loading} onClick={() => save(false)} icon={<Save className="h-4 w-4" />}>ذخیره پیش‌نویس</Button><Button loading={loading} onClick={() => save(true)} icon={<Eye className="h-4 w-4" />}>ذخیره و انتشار</Button></>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card><Field label="عنوان" required><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="text-lg font-bold" autoFocus /></Field><Field label="خلاصه" className="mt-3"><Textarea value={v.excerpt} onChange={(e) => setV({ ...v, excerpt: e.target.value })} className="min-h-[60px]" /></Field></Card>
          <Card title="متن مقاله" subtitle="با Markdown بنویسید: ## عنوان، **پررنگ**، - لیست" actions={<Tabs value={mode} onChange={setMode} tabs={[{ key: "edit", label: <PenLine className="h-4 w-4" /> }, { key: "preview", label: <Eye className="h-4 w-4" /> }]} />}>
            {mode === "edit" ? <Textarea value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} className="min-h-[420px] font-sans leading-7" /> : <div className="prose-fa min-h-[420px] rounded-xl bg-sand-50 p-4"><ReactMarkdown remarkPlugins={[remarkGfm]}>{v.content}</ReactMarkdown></div>}
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="انتشار">
            <Toggle checked={v.published} onChange={(c) => setV({ ...v, published: c })} label="منتشر شود" description="در سایت عمومی نمایش داده می‌شود" />
            <Field label="آدرس (slug)" hint="خالی = خودکار از عنوان" className="mt-3"><Input value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} dir="ltr" /></Field>
          </Card>
          <Card title="تصویر شاخص">
            {v.coverImage && <img src={v.coverImage} alt="" className="mb-3 h-40 w-full rounded-xl object-cover" />}
            <label className="btn-secondary w-full cursor-pointer"><Upload className="h-4 w-4" />بارگذاری تصویر<input type="file" accept="image/*" className="hidden" onChange={upload} /></label>
            <Field label="یا آدرس تصویر" className="mt-3"><Input value={v.coverImage} onChange={(e) => setV({ ...v, coverImage: e.target.value })} dir="ltr" /></Field>
          </Card>
          <Card title="دسته‌بندی">
            <Field label="دسته"><Input value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} placeholder="آموزشی، کودکان، بزرگسالان..." /></Field>
            <Field label="برچسب‌ها" hint="با ویرگول جدا کنید" className="mt-3"><Input value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} /></Field>
          </Card>
        </div>
      </div>
    </>
  );
}
