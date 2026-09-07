"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Star, Check } from "lucide-react";
import { toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { Button, Spinner, Textarea } from "@/components/ui";
import { LogoMark } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.get<any>(`/public/survey/${token}`).then(setInfo).catch((e) => setError(e.message)); }, [token]);
  const submit = async () => {
    if (!rating) return toast.error("لطفاً امتیاز بدهید");
    setLoading(true);
    try { await api.post(`/public/survey/${token}`, { rating, comment }); setDone(true); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const labels = ["", "خیلی ناراضی", "ناراضی", "متوسط", "راضی", "خیلی راضی"];
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-sand-100 to-coral-50 p-4">
      <div className="card w-full max-w-md p-8 text-center animate-fade-up">
        <LogoMark className="mx-auto h-14 w-14" />
        {error ? <p className="mt-6 text-coral-600">{error}</p> : !info ? <Spinner /> : done || info.used ? (
          <><div className="mx-auto mt-6 grid h-14 w-14 place-items-center rounded-full bg-sage-100 text-sage-700"><Check className="h-7 w-7" /></div><h1 className="mt-4 text-xl font-black">سپاس از شما!</h1><p className="mt-2 text-sm text-slate-500">نظر شما ثبت شد و به بهبود خدمات {info.clinic} کمک می‌کند.</p></>
        ) : (
          <>
            <h1 className="mt-5 text-xl font-black text-brand-900">{info.name} عزیز</h1>
            <p className="mt-2 text-sm text-slate-500">شما {toPersianDigits(info.sessionCount)} جلسه در {info.clinic} گذرانده‌اید. چقدر از روند درمان راضی هستید؟</p>
            <div className="mt-6 flex justify-center gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)}><Star className={cn("h-10 w-10 transition", rating >= n ? "fill-amber-400 text-amber-400" : "text-sand-300 hover:text-amber-400")} /></button>)}</div>
            <p className="mt-2 h-5 text-sm font-medium text-brand-700">{labels[rating]}</p>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="اگر پیشنهاد یا نکته‌ای دارید بنویسید (اختیاری)" className="mt-4" />
            <Button className="mt-4 w-full" size="lg" loading={loading} onClick={submit}>ثبت نظر</Button>
          </>
        )}
      </div>
    </div>
  );
}
