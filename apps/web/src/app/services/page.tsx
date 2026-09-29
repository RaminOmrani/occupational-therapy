import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Brain, Sparkles, HeartPulse, Home, ClipboardCheck, ArrowLeft, Phone } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { publicContext, pageMeta, JsonLd, breadcrumbJsonLd, cityOf, cleanName } from "@/lib/seo";
import { toPersianDigits } from "@toranj/shared";

const ICONS: Record<string, any> = { activity: Activity, brain: Brain, sparkles: Sparkles, "heart-pulse": HeartPulse, home: Home, "clipboard-check": ClipboardCheck };

export async function generateMetadata(): Promise<Metadata> {
  const { s } = await publicContext();
  const city = cityOf(s);
  return pageMeta(s, { title: `خدمات کاردرمانی و توان‌بخشی در ${city}`, description: `فهرست خدمات کلینیک ${cleanName(s)} در ${city}: توان‌بخشی جسمی، شناختی، یکپارچگی حسی، توان‌بخشی سکته مغزی، مهارت‌های زندگی روزمره و ارزیابی تخصصی برای کودکان و بزرگسالان.`, path: "/services" });
}

export default async function ServicesPage() {
  const { clinic, s } = await publicContext();
  const services = clinic?.services ?? [];
  const city = cityOf(s);
  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={s["clinic.name"] ?? ""} logo={s["clinic.logo"]} />
      <JsonLd data={breadcrumbJsonLd(s, [{ name: "خدمات", path: "/services" }])} />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <nav aria-label="مسیر" className="mb-4 text-xs text-slate-400"><Link href="/" className="hover:text-brand-700">خانه</Link> › <span>خدمات</span></nav>
        <h1 className="text-3xl font-black leading-[1.5] text-brand-900">خدمات کاردرمانی و توان‌بخشی {cleanName(s)} در {city}</h1>
        <p className="mt-3 max-w-3xl leading-8 text-slate-600">{s["seo.servicesTitle"] ? "" : ""}هر خدمت با ارزیابی تخصصی شروع می‌شود و برنامه درمانی متناسب با شرایط هر مراجع طراحی می‌شود. روی هر خدمت بزنید تا توضیح کامل، افراد مناسب، روند جلسه‌ها و پرسش‌های متداول را ببینید.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((sv) => { const Icon = ICONS[sv.icon ?? ""] ?? Sparkles; return (
            <Link key={sv.slug} href={`/services/${sv.slug}`} className="group card p-6 transition hover:-translate-y-1 hover:shadow-card">
              {sv.coverImage ? <img src={sv.coverImage} alt={sv.title} className="mb-4 h-36 w-full rounded-2xl object-cover" loading="lazy" /> : <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white"><Icon className="h-6 w-6" /></div>}
              <h2 className="text-lg font-bold text-slate-800 group-hover:text-brand-700">{sv.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">{sv.shortDescription}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700">اطلاعات بیشتر <ArrowLeft className="h-4 w-4" /></span>
            </Link>
          ); })}
        </div>
        <div className="card mt-12 flex flex-col items-center gap-4 p-8 text-center md:flex-row md:justify-between md:text-right">
          <div><h2 className="text-xl font-black text-brand-900">نمی‌دانید کدام خدمت مناسب شماست؟</h2><p className="mt-1 text-sm text-slate-500">با یک جلسه ارزیابی، درمانگر بهترین مسیر را پیشنهاد می‌دهد.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/book" className="btn-primary">رزرو نوبت ارزیابی</Link>{s["clinic.phone"] && <a href={`tel:${s["clinic.phone"]}`} className="btn-secondary"><Phone className="h-4 w-4" /><span className="num" dir="ltr">{toPersianDigits(s["clinic.phone"])}</span></a>}</div>
        </div>
      </div>
      <PublicFooter settings={s} services={services} />
    </div>
  );
}
