import type { Metadata } from "next";
import { Smartphone, Share, PlusSquare, MoreVertical, Download, Store } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { getClinic } from "@/lib/server";
import { InstallCta } from "@/components/layout/InstallCta";

export const metadata: Metadata = { title: "نصب اپلیکیشن" };

export default async function AppPage() {
  const clinic = await getClinic();
  const s = clinic?.settings ?? {};
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} logo={s["clinic.logo"]} />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand-600 text-white"><Smartphone className="h-8 w-8" /></span>
          <h1 className="mt-4 text-3xl font-black text-brand-900">اپلیکیشن {s["clinic.name"]}</h1>
          <p className="mt-2 text-slate-500">برنامه جلسات، یادآوری، پرونده درمانی، تمرین خانگی، امور مالی و پیام با درمانگر؛ همه روی گوشی شما</p>
          <div className="mt-6"><InstallCta apkUrl={s["app.apkUrl"]} storeUrl={s["app.storeUrl"]} /></div>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="card p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Smartphone className="h-5 w-5 text-brand-600" />اندروید (Chrome)</h2>
            <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <li>۱. همین صفحه را در مرورگر <b>Chrome</b> باز کنید.</li>
              <li>۲. اگر پنجره «نصب» بالا آمد، آن را بزنید. در غیر این صورت منوی سه‌نقطه <MoreVertical className="inline h-4 w-4" /> بالای مرورگر ← <b>Add to Home screen</b> یا <b>Install app</b>.</li>
              <li>۳. آیکون «ذهن سبز» روی صفحه اصلی گوشی اضافه می‌شود.</li>
            </ol>
          </div>
          <div className="card p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Smartphone className="h-5 w-5 text-brand-600" />آیفون (Safari)</h2>
            <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <li>۱. همین صفحه را در مرورگر <b>Safari</b> باز کنید (نه Chrome).</li>
              <li>۲. دکمه اشتراک‌گذاری <Share className="inline h-4 w-4" /> پایین صفحه را بزنید.</li>
              <li>۳. گزینه <b>Add to Home Screen</b> <PlusSquare className="inline h-4 w-4" /> را انتخاب و <b>Add</b> را بزنید.</li>
            </ol>
          </div>
        </div>
        <div className="card mt-6 p-6 text-sm leading-7 text-slate-600">
          <p className="font-bold text-slate-800">ورود به اپلیکیشن</p>
          <p>بیماران با شماره موبایل ثبت‌شده در کلینیک و کد پیامکی وارد می‌شوند. اگر پرونده ندارید، از <a href="/book" className="text-brand-600 hover:underline">رزرو نوبت آنلاین</a> شروع کنید.</p>
        </div>
      </div>
      <PublicFooter settings={s} />
    </div>
  );
}
