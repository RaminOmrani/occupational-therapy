"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Phone, MapPin, AtSign, LogIn, LayoutDashboard } from "lucide-react";
import { Logo, LogoMark } from "./Logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toPersianDigits, toJalali } from "@toranj/shared";

const NAV = [
  { href: "/", label: "خانه" },
  { href: "/services", label: "خدمات" },
  { href: "/team", label: "تیم درمان" },
  { href: "/about", label: "درباره ما" },
  { href: "/media", label: "رسانه" },
  { href: "/book", label: "رزرو آنلاین" },
  { href: "/app", label: "نصب اپلیکیشن" },
  { href: "/contact", label: "تماس با ما" },
];

export function PublicNav({ clinicName, logo }: { clinicName: string; logo?: string | null }) {
  const path = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-sand-200/70 bg-sand-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/"><Logo name={clinicName} src={logo} /></Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn("rounded-xl px-3.5 py-2 text-sm font-medium transition hover:bg-brand-50 hover:text-brand-700", path === n.href ? "text-brand-700" : "text-slate-600")}>{n.label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link href="/panel" className="btn-primary" ><LayoutDashboard className="h-4 w-4" />ورود به پنل</Link>
          ) : (
            <Link href="/login" className="btn-primary"><LogIn className="h-4 w-4" />ورود به سامانه</Link>
          )}
        </div>
        <button className="rounded-xl p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="منو">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="border-t border-sand-200 bg-white px-4 py-3 md:hidden">
          {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50">{n.label}</Link>)}
          <Link href={user ? "/panel" : "/login"} onClick={() => setOpen(false)} className="btn-primary mt-2 w-full">{user ? "ورود به پنل" : "ورود به سامانه"}</Link>
        </div>
      )}
    </header>
  );
}

export function PublicFooter({ settings, services = [] }: { settings: Record<string, string>; services?: { slug: string; title: string }[] }) {
  return (
    <footer className="mt-20 bg-brand-900 text-brand-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">{settings["clinic.logo"] ? <img src={settings["clinic.logo"]} alt={`لوگوی ${settings["clinic.name"] ?? "کلینیک"}`} className="h-10 w-10 rounded-xl bg-[#f8f2e1] object-contain p-0.5" loading="lazy" /> : <LogoMark />}<span className="text-lg font-extrabold text-white">{settings["clinic.name"]}</span></div>
          <p className="mt-4 text-sm leading-7 text-brand-200">{settings["clinic.tagline"]}</p>
        </div>
        {services.length > 0 && (
          <div>
            <h4 className="mb-4 font-bold text-white">خدمات کاردرمانی و توان‌بخشی</h4>
            <ul className="space-y-2 text-sm">
              {services.map((sv) => <li key={sv.slug}><Link href={`/services/${sv.slug}`} className="hover:text-white">{sv.title}</Link></li>)}
              <li><Link href="/services" className="text-brand-300 hover:text-white">همه خدمات</Link></li>
            </ul>
          </div>
        )}
        <div>
          <h4 className="mb-4 font-bold text-white">دسترسی سریع</h4>
          <ul className="space-y-2 text-sm">
            {NAV.map((n) => <li key={n.href}><Link href={n.href} className="hover:text-white">{n.label}</Link></li>)}
            <li><Link href="/privacy" className="hover:text-white">حریم خصوصی</Link></li>
            <li><Link href="/login" className="hover:text-white">ورود مراجعین و همکاران</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 font-bold text-white">ارتباط با ما</h4>
          <ul className="space-y-3 text-sm">
            {settings["clinic.phone"] && <li className="flex items-center gap-2"><Phone className="h-4 w-4" /><span className="num" dir="ltr">{toPersianDigits(settings["clinic.phone"])}</span></li>}
            {settings["clinic.address"] && <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{settings["clinic.address"]}</span></li>}
            {settings["clinic.instagram"] && <li className="flex items-center gap-2"><AtSign className="h-4 w-4" /><span dir="ltr">{settings["clinic.instagram"]}</span></li>}
            {settings["clinic.workingHours"] && <li className="text-brand-300">{settings["clinic.workingHours"]}</li>}
            {settings["clinic.licenseNo"] && <li className="text-brand-300">شماره نظام: <span className="num">{settings["clinic.licenseNo"]}</span></li>}
            <li className="pt-2 text-xs text-brand-300">کلینیک کاردرمانی و توان‌بخشی ذهن سبز در {settings["clinic.city"] || "مشهد"}</li>
          </ul>
        </div>
      </div>
      <TrustBadges settings={settings} />
      <div className="border-t border-brand-800 py-4 text-center text-xs text-brand-300">© {toPersianDigits(toJalali(new Date()).jy)} {settings["clinic.name"]} — تمامی حقوق محفوظ است</div>
    </footer>
  );
}

/**
 * نمادهای اعتماد پایین سایت:
 * - اینماد: فقط id و Code از کد اینماد استخراج و با آدرس رسمی trustseal.enamad.ir ساخته می‌شود
 * - زیبال: نسخه HTML بدون اسکریپت طبق مستندات زیبال (gateway.zibal.ir/trustMe/دامنه)
 */
function TrustBadges({ settings }: { settings: Record<string, string> }) {
  const code = settings["public.enamadCode"];
  const id = code?.match(/[?&]id=(\d+)/i)?.[1];
  const c = code?.match(/[?&]Code=([A-Za-z0-9]+)/)?.[1];
  const host = (settings["site.baseUrl"] || "https://zehnesabz.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const zibal = settings["public.zibalTrust"] === "true";
  if (!(id && c) && !zibal) return null;
  const q = `id=${id}&Code=${c}`;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pb-6">
      {id && c && (
        <a referrerPolicy="origin" target="_blank" rel="noopener" href={`https://trustseal.enamad.ir/?${q}`} className="rounded-2xl bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img referrerPolicy="origin" src={`https://trustseal.enamad.ir/logo.aspx?${q}`} alt="نماد اعتماد الکترونیکی" width={110} height={110} style={{ cursor: "pointer" }} {...({ code: c } as Record<string, string>)} />
        </a>
      )}
      {zibal && (
        <a href={`https://gateway.zibal.ir/trustMe/${host}`} target="_blank" rel="noopener" className="rounded-2xl bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://zibal.ir/trust/assets/2.png" alt="پرداخت امن با زیبال" style={{ maxWidth: 110, height: "auto" }} />
        </a>
      )}
    </div>
  );
}
