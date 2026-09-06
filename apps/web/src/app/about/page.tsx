import type { Metadata } from "next";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { getClinic } from "@/lib/server";
import { Avatar } from "@/components/ui";

export const metadata: Metadata = { title: "درباره ما" };

export default async function AboutPage() {
  const clinic = await getClinic();
  const s = clinic?.settings ?? {};
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-black text-brand-900">درباره {s["clinic.name"]}</h1>
        <p className="mt-6 whitespace-pre-line text-base leading-9 text-slate-600">{s["clinic.about"]}</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[["ارزیابی دقیق", "سه پروفایل تخصصی جسمی، ادراکی-حرکتی و شناختی برای هر مراجع"], ["برنامه شخصی", "اهداف درمانی مشخص با پیگیری درصدی پیشرفت"], ["شفافیت کامل", "دسترسی خانواده به پرونده، برنامه و وضعیت مالی از طریق اپلیکیشن"]].map(([t, d]) => (
            <div key={t} className="card p-5"><h3 className="font-bold text-brand-800">{t}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{d}</p></div>
          ))}
        </div>
        {clinic?.therapists?.length ? (
          <>
            <h2 className="mt-14 text-2xl font-black text-brand-900">درمانگران ما</h2>
            <div className="mt-6 space-y-4">
              {clinic.therapists.map((t) => (
                <div key={t.id} className="card flex gap-4 p-5">
                  <Avatar name={t.fullName} src={t.avatar} size="xl" />
                  <div><h3 className="text-lg font-bold">{t.fullName}</h3><p className="text-sm text-brand-700">{t.specialty}</p><p className="mt-2 leading-7 text-slate-500">{t.bio}</p></div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <PublicFooter settings={s} />
    </div>
  );
}
