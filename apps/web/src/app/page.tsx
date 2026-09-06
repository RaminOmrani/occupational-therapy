import Link from "next/link";
import { Activity, Brain, Sparkles, HeartPulse, Home, ClipboardCheck, ArrowLeft, CalendarCheck, LineChart, MessageSquareHeart, Smartphone, ShieldCheck } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { ContactForm } from "@/components/layout/ContactForm";
import { getClinic } from "@/lib/server";
import { serverGet } from "@/lib/api";
import { toPersianDigits, formatJalaliLong } from "@toranj/shared";
import { Avatar } from "@/components/ui";
import { ArticleCard } from "@/components/layout/ArticleCard";

const ICONS: Record<string, any> = { activity: Activity, brain: Brain, sparkles: Sparkles, "heart-pulse": HeartPulse, home: Home, "clipboard-check": ClipboardCheck };

export default async function HomePage() {
  const clinic = await getClinic();
  const s = clinic?.settings ?? {};
  const name = s["clinic.name"] ?? "کلینیک کاردرمانی";
  let services: { title: string; description: string; icon: string }[] = [];
  try { services = JSON.parse(s["clinic.services"] ?? "[]"); } catch {}
  const articles = (await serverGet<{ items: any[] }>("/articles/public", 60))?.items?.slice(0, 3) ?? [];

  return (
    <div className="bg-sand-50">
      <PublicNav clinicName={name} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-40 h-96 w-96 rounded-full bg-coral-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-fade-up">
            <span className="badge bg-brand-100 text-brand-800">کاردرمانی کودکان و بزرگسالان</span>
            <h1 className="mt-5 text-3xl font-black leading-[1.35] text-brand-900 md:text-5xl md:leading-[1.3]">{s["public.heroTitle"]}</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">{s["public.heroSubtitle"]}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/contact" className="btn-primary px-6 py-3 text-base">رزرو ارزیابی اولیه<ArrowLeft className="h-4 w-4" /></Link>
              <Link href="/login" className="btn-secondary px-6 py-3 text-base">ورود بیماران</Link>
            </div>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[{ v: clinic?.stats.patients ?? 0, l: "مراجع" }, { v: clinic?.stats.sessions ?? 0, l: "جلسه درمانی" }, { v: clinic?.therapists.length ?? 0, l: "درمانگر متخصص" }].map((x) => (
                <div key={x.l} className="rounded-2xl border border-sand-200 bg-white/70 p-3 text-center">
                  <div className="num text-2xl font-black text-brand-700">{toPersianDigits(x.v)}+</div>
                  <div className="text-xs text-slate-500">{x.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md animate-float">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-black text-brand-900 md:text-3xl">خدمات ما</h2>
          <p className="mt-2 text-slate-500">رویکرد جامع و مبتنی بر شواهد برای هر مراجع</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((sv, i) => {
            const Icon = ICONS[sv.icon] ?? Sparkles;
            return (
              <div key={i} className="group card p-6 transition hover:-translate-y-1 hover:shadow-card">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white"><Icon className="h-6 w-6" /></div>
                <h3 className="text-lg font-bold text-slate-800">{sv.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">{sv.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* App features */}
      <section className="bg-brand-900 py-16 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <span className="badge bg-brand-700 text-brand-100">اپلیکیشن بیماران</span>
              <h2 className="mt-4 text-2xl font-black md:text-3xl">پرونده درمانی شما، همیشه در دسترس</h2>
              <p className="mt-4 leading-8 text-brand-100">با همان شماره موبایل وارد شوید و برنامه جلسات، نتایج ارزیابی‌ها، گزارش پیشرفت، تمرین‌های خانگی و وضعیت مالی خود را ببینید.</p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  [CalendarCheck, "برنامه جلسات با یادآوری پیامکی ۲ ساعت قبل"],
                  [LineChart, "نمودار پیشرفت و نتایج ارزیابی‌های جسمی، ادراکی-حرکتی و شناختی"],
                  [Smartphone, "کیف پول، صورت‌حساب و پرداخت‌ها به‌صورت شفاف"],
                  [MessageSquareHeart, "ثبت انتقاد و پیشنهاد و دریافت پاسخ"],
                  [ShieldCheck, "ورود امن با کد یکبارمصرف"],
                ].map(([Icon, t]: any, i) => (
                  <li key={i} className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-800"><Icon className="h-4 w-4 text-amber-400" /></span>{t}</li>
                ))}
              </ul>
              <Link href="/login" className="btn-accent mt-8">ورود به اپلیکیشن</Link>
            </div>
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* Therapists */}
      {clinic?.therapists?.length ? (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-black text-brand-900 md:text-3xl">تیم درمانگران</h2>
            <p className="mt-2 text-slate-500">متخصصانی دلسوز با تجربه بالینی</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {clinic.therapists.map((t) => (
              <div key={t.id} className="card flex gap-4 p-5">
                <Avatar name={t.fullName} src={t.avatar} size="lg" />
                <div>
                  <h3 className="font-bold">{t.fullName}</h3>
                  <p className="text-xs text-brand-700">{t.specialty}</p>
                  {t.bio && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{t.bio}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Articles */}
      {articles.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-brand-900 md:text-3xl">مقالات آموزشی</h2>
              <p className="mt-2 text-slate-500">دانستنی‌های کاردرمانی برای خانواده‌ها</p>
            </div>
            <Link href="/articles" className="text-sm font-medium text-brand-700 hover:underline">همه مقالات</Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {articles.map((a) => <ArticleCard key={a.id} a={a} />)}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid overflow-hidden rounded-3xl bg-white shadow-card md:grid-cols-2">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-white md:p-12">
            <h2 className="text-2xl font-black">همین امروز شروع کنید</h2>
            <p className="mt-3 leading-8 text-brand-100">شماره خود را بگذارید؛ کارشناس ما برای هماهنگی جلسه ارزیابی اولیه با شما تماس می‌گیرد.</p>
            <div className="mt-8 space-y-2 text-sm text-brand-100">
              {s["clinic.phone"] && <p>☎ <span className="num" dir="ltr">{toPersianDigits(s["clinic.phone"])}</span></p>}
              {s["clinic.address"] && <p>📍 {s["clinic.address"]}</p>}
              {s["clinic.workingHours"] && <p>🕘 {s["clinic.workingHours"]}</p>}
            </div>
          </div>
          <div className="p-8 md:p-12"><ContactForm /></div>
        </div>
      </section>

      <PublicFooter settings={s} />
    </div>
  );
}

function HeroIllustration() {
  return (
    <svg viewBox="0 0 400 360" className="w-full drop-shadow-xl" aria-hidden>
      <defs>
        <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#0f8b8d" /><stop offset="1" stopColor="#13494b" /></linearGradient>
        <linearGradient id="g2" x1="0" x2="1"><stop offset="0" stopColor="#f4a261" /><stop offset="1" stopColor="#e76f51" /></linearGradient>
      </defs>
      <rect x="20" y="20" width="360" height="320" rx="40" fill="#fff" />
      <circle cx="300" cy="90" r="50" fill="#d5f5f3" />
      <circle cx="90" cy="280" r="60" fill="#fde6dd" />
      <path d="M120 250c0-40 20-70 60-80l70-18c14-4 26 6 26 20 0 10-6 18-16 21l-40 12" fill="none" stroke="url(#g1)" strokeWidth="14" strokeLinecap="round" />
      <path d="M180 240c30-10 60-10 90 0" fill="none" stroke="url(#g2)" strokeWidth="14" strokeLinecap="round" />
      <circle cx="205" cy="130" r="32" fill="url(#g1)" />
      <path d="M150 300h100" stroke="#e2dbcc" strokeWidth="10" strokeLinecap="round" />
      <g fill="#fff">
        <rect x="60" y="60" width="120" height="14" rx="7" fill="#efeae0" />
        <rect x="60" y="86" width="80" height="14" rx="7" fill="#efeae0" />
      </g>
      <path d="M262 190l14 14 28-32" fill="none" stroke="#7ba874" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="275" cy="190" r="34" fill="none" stroke="#b9d3b3" strokeWidth="6" />
    </svg>
  );
}

function PhoneMock() {
  return (
    <div className="mx-auto w-64 rounded-[2.5rem] border-8 border-brand-950 bg-sand-50 p-4 text-slate-800 shadow-card">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-brand-950" />
      <p className="text-xs text-slate-400">سلام، امیرحسین 👋</p>
      <p className="font-bold">جلسه بعدی شما</p>
      <div className="mt-2 rounded-2xl bg-brand-600 p-3 text-white">
        <p className="text-xs opacity-80">شنبه ۱۶ شهریور</p>
        <p className="num text-lg font-bold">۱۰:۰۰ - مریم محمدی</p>
      </div>
      <p className="mt-4 text-xs font-bold">پیشرفت ارزیابی‌ها</p>
      {[["جسمی", 72, "bg-brand-500"], ["ادراکی-حرکتی", 58, "bg-amber-400"], ["شناختی", 64, "bg-violet-500"]].map(([l, v, c]: any) => (
        <div key={l} className="mt-2">
          <div className="flex justify-between text-[10px]"><span>{l}</span><span className="num">{toPersianDigits(v)}٪</span></div>
          <div className="h-1.5 rounded-full bg-sand-200"><div className={`h-full rounded-full ${c}`} style={{ width: `${v}%` }} /></div>
        </div>
      ))}
      <div className="mt-4 rounded-2xl bg-white p-3 text-xs shadow-soft">
        <p className="text-slate-400">کیف پول</p>
        <p className="num font-bold text-brand-700">۳۰۰,۰۰۰ تومان</p>
      </div>
    </div>
  );
}
