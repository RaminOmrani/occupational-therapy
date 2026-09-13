"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar } from "./index";
import { cn } from "@/lib/utils";

/** آواتار با امکان آپلود عکس (کلیک روی تصویر) */
export function AvatarUpload({ name, src, target, id, size = "lg", canEdit = true, className, onUploaded }: { name: string; src?: string | null; target: "patient" | "user" | "clinic"; id?: string; size?: "sm" | "md" | "lg" | "xl"; canEdit?: boolean; className?: string; onUploaded?: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("فقط تصویر مجاز است");
    if (f.size > 8 * 1024 * 1024) return toast.error("حجم تصویر باید کمتر از ۸ مگابایت باشد");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("target", target);
      if (id) fd.append("id", id);
      const r = await api.post<{ url: string }>("/uploads/avatar", fd);
      setPreview(r.url);
      toast.success("عکس ذخیره شد");
      qc.invalidateQueries();
      refresh();
      onUploaded?.(r.url);
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); e.target.value = ""; }
  };
  return (
    <div className={cn("group relative inline-block shrink-0", className)}>
      <Avatar name={name} src={preview ?? src} size={size} />
      {canEdit && (
        <>
          <button type="button" onClick={() => ref.current?.click()} title="تغییر عکس" className="absolute -bottom-1 -left-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-brand-600 text-white shadow transition hover:bg-brand-700">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
        </>
      )}
    </div>
  );
}
