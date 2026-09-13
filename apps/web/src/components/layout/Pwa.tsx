"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Share, PlusSquare, Smartphone, X } from "lucide-react";

let deferredPrompt: any = null;
const listeners = new Set<() => void>();

/** ثبت سرویس‌ورکر و گرفتن رویداد نصب (اندروید/دسکتاپ) */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => null);
    const onPrompt = (e: any) => { e.preventDefault(); deferredPrompt = e; listeners.forEach((l) => l()); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}

export function usePwaInstall() {
  const [, tick] = useState(0);
  useEffect(() => { const l = () => tick((n) => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  const isStandalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const canPrompt = !!deferredPrompt;
  const install = async () => { if (!deferredPrompt) return false; deferredPrompt.prompt(); const r = await deferredPrompt.userChoice; deferredPrompt = null; listeners.forEach((l) => l()); return r?.outcome === "accepted"; };
  return { isStandalone, isIos, canPrompt, install };
}

/** بنر نصب اپ: اندروید دکمه نصب، آیفون راهنمای Add to Home Screen */
export function InstallBanner({ compact }: { compact?: boolean }) {
  const { isStandalone, isIos, canPrompt, install } = usePwaInstall();
  const [hidden, setHidden] = useState(false);
  useEffect(() => { try { setHidden(localStorage.getItem("pwa-banner-hidden") === "1"); } catch {} }, []);
  if (isStandalone || hidden) return null;
  if (!canPrompt && !isIos) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem("pwa-banner-hidden", "1"); } catch {} };
  return (
    <div className={`relative mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-gradient-to-l from-brand-50 to-white p-4 ${compact ? "text-sm" : ""}`}>
      <button onClick={dismiss} className="absolute left-2 top-2 rounded-full p-1 text-slate-400 hover:bg-sand-200"><X className="h-4 w-4" /></button>
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white"><Smartphone className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-brand-900">اپلیکیشن ذهن سبز را روی گوشی نصب کنید</p>
        {isIos ? (
          <p className="mt-1 text-xs leading-6 text-slate-500">در Safari دکمه <Share className="inline h-3.5 w-3.5" /> (اشتراک‌گذاری) را بزنید، سپس <b>Add to Home Screen</b> <PlusSquare className="inline h-3.5 w-3.5" /> را انتخاب کنید.</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">دسترسی سریع از صفحه اصلی گوشی، بدون نیاز به فروشگاه</p>
        )}
      </div>
      {canPrompt && <button onClick={install} className="btn-primary"><Download className="h-4 w-4" />نصب</button>}
      {!compact && <Link href="/app" className="text-xs text-brand-600 hover:underline">راهنمای کامل</Link>}
    </div>
  );
}
