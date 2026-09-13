"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Input } from "@/components/ui";

/** فیلد لینک APK + دکمه آپلود مستقیم فایل از مرورگر */
export function ApkUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".apk")) return toast.error("فقط فایل .apk مجاز است");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await api.post<{ url: string; size: number }>("/uploads/apk", fd);
      onChange(r.url);
      toast.success(`فایل APK آپلود و لینکش ثبت شد (${(r.size / 1024 / 1024).toFixed(1)} مگابایت)`);
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); e.target.value = ""; }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" className="min-w-0 flex-1" placeholder="https://... یا آپلود مستقیم" />
      <Button type="button" variant="secondary" onClick={() => ref.current?.click()} icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} disabled={loading}>آپلود فایل APK</Button>
      <input ref={ref} type="file" accept=".apk" className="hidden" onChange={pick} />
      {value && <a href={value} className="text-xs text-brand-600 hover:underline" download>تست دانلود</a>}
    </div>
  );
}
