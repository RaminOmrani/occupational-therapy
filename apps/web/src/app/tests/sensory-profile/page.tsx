import type { Metadata } from "next";
import Link from "next/link";
import { SENSORY_PROFILE_2 as def, toPersianDigits } from "@toranj/shared";
import { PublicNav, PublicFooter } from "@/components/layout/PublicShell";
import { QuestionnaireForm } from "@/components/questionnaire/QuestionnaireForm";
import { publicContext, pageMeta, JsonLd, breadcrumbJsonLd, cityOf, cleanName } from "@/lib/seo";

const PATH = "/tests/sensory-profile";

export async function generateMetadata(): Promise<Metadata> {
  const { s } = await publicContext();
  return pageMeta(s, {
    title: `آزمون پروفایل حسی کودک | ${cleanName(s)}`,
    description: `پرسشنامه آنلاین پروفایل حسی ۲ برای والدین: بررسی پاسخ کودک به صدا، نور، لمس، حرکت، بو و مزه. پاسخ‌ها توسط کاردرمانگر ${cleanName(s)} در ${cityOf(s)} بررسی می‌شود.`,
    path: PATH,
    noTitleSuffix: true,
    keywords: ["پروفایل حسی", "آزمون پروفایل حسی کودک", "پردازش حسی کودکان", "یکپارچگی حسی", "کاردرمانی کودکان"],
  });
}

/** صفحه عمومی آزمون پروفایل حسی؛ لینک انتهای مقاله «پردازش حسی در کودکان» به اینجا می‌آید */
export default async function SensoryProfilePage() {
  const { s, clinic } = await publicContext();
  const count = def.sections.reduce((n, sec) => n + sec.items.length, 0);
  return (
    <div className="bg-sand-50">
      <JsonLd data={breadcrumbJsonLd(s, [{ name: "آزمون پروفایل حسی کودک", path: PATH }])} />
      <PublicNav clinicName={s["clinic.name"] ?? ""} logo={s["clinic.logo"]} />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <nav className="mb-4 text-xs text-slate-400"><Link href="/" className="hover:text-brand-700">خانه</Link> / <Link href="/media/sensory-processing-children" className="hover:text-brand-700">پردازش حسی در کودکان</Link> / آزمون پروفایل حسی</nav>
        <h1 className="text-2xl font-black leading-tight text-brand-900 sm:text-3xl">{def.title}: پرسشنامه والدین</h1>
        <p className="mt-3 text-sm leading-8 text-slate-600">{def.intro}</p>
        <ul className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
          <li className="card px-4 py-3"><b className="num block text-lg text-brand-800">{toPersianDigits(count)}</b>سؤال در ۹ حوزه</li>
          <li className="card px-4 py-3"><b className="block text-lg text-brand-800">حدود ۲۰ دقیقه</b>زمان تقریبی تکمیل</li>
          <li className="card px-4 py-3"><b className="block text-lg text-brand-800">بررسی توسط کاردرمانگر</b>نتیجه پس از بررسی اعلام می‌شود</li>
        </ul>
        <p className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs leading-6 text-slate-600">این ابزار به‌تنهایی تشخیص‌دهنده اختلال نیست و نتایج آن باید در کنار سایر اطلاعات مربوط به رشد و عملکرد کودک و با نظر متخصص تفسیر شود.</p>
        <div className="mt-6">
          <QuestionnaireForm def={def} loginHref={`/login?next=${encodeURIComponent(PATH)}`} />
        </div>
      </div>
      <PublicFooter settings={s} services={clinic?.services ?? []} />
    </div>
  );
}
