import type { Metadata } from "next";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { getClinic } from "@/lib/server";
import { BookingWizard } from "@/components/layout/BookingWizard";

export const metadata: Metadata = { title: "رزرو نوبت آنلاین" };

export default async function BookPage() {
  const clinic = await getClinic();
  const s = clinic?.settings ?? {};
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-black text-brand-900">رزرو نوبت آنلاین</h1>
        <p className="mt-2 text-slate-500">درمانگر و زمان دلخواه را انتخاب کنید؛ پس از تأیید کلینیک، پیامک تأیید دریافت می‌کنید.</p>
        <div className="mt-8"><BookingWizard phone={s["clinic.phone"] ?? ""} /></div>
      </div>
      <PublicFooter settings={s} />
    </div>
  );
}
