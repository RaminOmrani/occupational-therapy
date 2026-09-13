"use client";
import { Download, Store, CheckCircle2 } from "lucide-react";
import { usePwaInstall } from "./Pwa";

export function InstallCta({ apkUrl, storeUrl }: { apkUrl?: string; storeUrl?: string }) {
  const { isStandalone, canPrompt, install } = usePwaInstall();
  if (isStandalone) return <p className="inline-flex items-center gap-2 rounded-2xl bg-sage-100 px-4 py-2 text-sage-700"><CheckCircle2 className="h-5 w-5" />اپلیکیشن نصب شده و در حال اجراست</p>;
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {canPrompt && <button onClick={install} className="btn-primary px-6 py-3 text-base"><Download className="h-5 w-5" />نصب اپلیکیشن</button>}
      {storeUrl && <a href={storeUrl} target="_blank" className="btn-secondary px-6 py-3 text-base"><Store className="h-5 w-5" />دریافت از فروشگاه</a>}
      {apkUrl && <a href={apkUrl} className="btn-secondary px-6 py-3 text-base"><Download className="h-5 w-5" />دانلود مستقیم اندروید (APK)</a>}
      {!canPrompt && !storeUrl && !apkUrl && <p className="text-sm text-slate-500">طبق راهنمای زیر، از منوی مرورگر نصب کنید.</p>}
    </div>
  );
}
