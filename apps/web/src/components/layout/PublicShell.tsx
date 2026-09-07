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
  { href: "/about", label: "درباره ما" },
  { href: "/articles", label: "مقالات" },
  { href: "/book", label: "رزرو آنلاین" },
  { href: "/contact", label: "تماس با ما" },
];

export function PublicNav({ clinicName }: { clinicName: string }) {
  const path = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-sand-200/70 bg-sand-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/"><Logo name={clinicName} /></Link>
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

export function PublicFooter({ settings }: { settings: Record<string, string> }) {
  return (
    <footer className="mt-20 bg-brand-900 text-brand-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5"><LogoMark /><span className="text-lg font-extrabold text-white">{settings["clinic.name"]}</span></div>
          <p className="mt-4 text-sm leading-7 text-brand-200">{settings["clinic.tagline"]}</p>
        </div>
        <div>
          <h4 className="mb-4 font-bold text-white">دسترسی سریع</h4>
          <ul className="space-y-2 text-sm">
            {NAV.map((n) => <li key={n.href}><Link href={n.href} className="hover:text-white">{n.label}</Link></li>)}
            <li><Link href="/login" className="hover:text-white">ورود بیماران و همکاران</Link></li>
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
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-800 py-4 text-center text-xs text-brand-300">© {toPersianDigits(toJalali(new Date()).jy)} {settings["clinic.name"]} — تمامی حقوق محفوظ است</div>
    </footer>
  );
}
