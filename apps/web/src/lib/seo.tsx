import type { Metadata } from "next";
import { getClinic } from "@/lib/server";

export type Settings = Record<string, string>;

/** آدرس پایه سایت از تنظیمات (site.baseUrl)؛ بدون اسلش انتهایی */
export function siteUrl(s: Settings) {
  const raw = (process.env.SITE_URL || s["site.baseUrl"] || "https://zehnesabz.com").trim().replace(/\/$/, "");
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}
/** نام کلینیک بدون ایموجی برای عنوان‌ها و داده ساختاریافته */
export function cleanName(s: Settings) {
  return (s["clinic.name"] ?? "کلینیک ذهن سبز").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
}
export function cityOf(s: Settings) { return s["clinic.city"] || "مشهد"; }
export function phoneIntl(phone: string | undefined) {
  const p = (phone ?? "").replace(/\D/g, "");
  if (!p) return undefined;
  return p.startsWith("0") ? `+98${p.slice(1)}` : p.startsWith("98") ? `+${p}` : p;
}

/** متادیتای استاندارد هر صفحه عمومی: title، description، canonical، Open Graph و Twitter */
/** توضیح متا حداکثر ~۱۶۰ حرف، بریده‌شده در مرز کلمه */
export function trimDesc(text: string, max = 160) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 100)).replace(/[،,؛;:\-]+$/, "") + "…";
}

export function pageMeta(s: Settings, opts: { title: string; description: string; path: string; image?: string | null; type?: "website" | "article"; noTitleSuffix?: boolean; keywords?: string[]; publishedTime?: string; modifiedTime?: string; authors?: string[] }): Metadata {
  const base = siteUrl(s);
  const name = cleanName(s);
  const url = `${base}${opts.path}`;
  const img = opts.image ? (opts.image.startsWith("http") ? opts.image : `${base}${opts.image}`) : `${base}/og.png`;
  const fullTitle = opts.noTitleSuffix ? opts.title : `${opts.title} | ${name}`;
  const description = trimDesc(opts.description);
  return {
    title: { absolute: fullTitle },
    description,
    keywords: opts.keywords,
    alternates: { canonical: url },
    openGraph: { type: opts.type ?? "website", url, title: fullTitle, description, siteName: name, locale: "fa_IR", images: [{ url: img, width: 1200, height: 630, alt: opts.title }], ...(opts.type === "article" ? { publishedTime: opts.publishedTime, modifiedTime: opts.modifiedTime, authors: opts.authors } : {}) },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [img] },
  };
}

/** درج JSON-LD در صفحه */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const DAY_MAP: Record<string, string> = { "شنبه": "Saturday", "یکشنبه": "Sunday", "دوشنبه": "Monday", "سه‌شنبه": "Tuesday", "سه شنبه": "Tuesday", "چهارشنبه": "Wednesday", "پنجشنبه": "Thursday", "پنج‌شنبه": "Thursday", "جمعه": "Friday" };
function hh(n: string | undefined, d: number) { const v = Number(n); return `${String(isNaN(v) || !n ? d : v).padStart(2, "0")}:00`; }

/** MedicalClinic: آدرس، تلفن، ساعت کاری، مختصات و شهر خدمت‌رسانی از تنظیمات */
export function clinicJsonLd(s: Settings, therapists: { fullName: string; slug: string; specialty?: string | null }[] = []) {
  const base = siteUrl(s);
  const days = (s["clinic.openDays"] ?? "").split(/[,،]/).map((d) => DAY_MAP[d.trim()]).filter(Boolean);
  const lat = Number(s["clinic.geoLat"]), lng = Number(s["clinic.geoLng"]);
  const data: any = {
    "@context": "https://schema.org",
    "@type": ["MedicalClinic", "MedicalBusiness", "LocalBusiness"],
    "@id": `${base}/#clinic`,
    name: cleanName(s),
    alternateName: ["کلینیک ذهن سبز", "ذهن سبز", "کلینیک کاردرمانی ذهن سبز", "کلینیک توان بخشی ذهن سبز"],
    url: base,
    logo: `${base}${s["clinic.logo"] || "/brand/logo-mark.png"}`,
    image: `${base}/og.png`,
    description: s["seo.homeDescription"] || s["clinic.about"],
    telephone: phoneIntl(s["clinic.phone"]),
    address: { "@type": "PostalAddress", streetAddress: s["clinic.address"], addressLocality: cityOf(s), addressRegion: "خراسان رضوی", postalCode: s["clinic.postalCode"] || undefined, addressCountry: "IR" },
    areaServed: { "@type": "City", name: cityOf(s) },
    medicalSpecialty: ["Occupational therapy", "Physiotherapy"],
    priceRange: "$$",
    inLanguage: "fa",
  };
  if (s["clinic.email"]) data.email = s["clinic.email"];
  if (s["clinic.instagram"]) data.sameAs = [s["clinic.instagram"].startsWith("http") ? s["clinic.instagram"] : `https://instagram.com/${s["clinic.instagram"].replace(/^@/, "")}`];
  if (s["clinic.mapUrl"]) data.hasMap = s["clinic.mapUrl"];
  if (!isNaN(lat) && !isNaN(lng) && s["clinic.geoLat"] && s["clinic.geoLng"]) data.geo = { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
  if (days.length) data.openingHoursSpecification = [{ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: hh(s["schedule.startHour"], 8), closes: hh(s["schedule.endHour"], 22) }];
  if (therapists.length) data.employee = therapists.map((t) => ({ "@type": "Person", name: t.fullName, jobTitle: t.specialty || "کاردرمانگر", url: `${base}/team/${t.slug}` }));
  return data;
}

export function websiteJsonLd(s: Settings) {
  const base = siteUrl(s);
  return { "@context": "https://schema.org", "@type": "WebSite", "@id": `${base}/#website`, url: base, name: cleanName(s), inLanguage: "fa", publisher: { "@id": `${base}/#clinic` }, potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${base}/media?q={search_term_string}` }, "query-input": "required name=search_term_string" } };
}

export function breadcrumbJsonLd(s: Settings, items: { name: string; path: string }[]) {
  const base = siteUrl(s);
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ name: "خانه", path: "/" }, ...items].map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${base}${it.path}` })) };
}

export function personJsonLd(s: Settings, t: { fullName: string; slug: string; specialty?: string | null; bio?: string | null; avatar?: string | null; credentials?: string | null; licenseNo?: string | null }) {
  const base = siteUrl(s);
  const data: any = { "@context": "https://schema.org", "@type": "Person", "@id": `${base}/team/${t.slug}#person`, name: t.fullName, url: `${base}/team/${t.slug}`, jobTitle: t.specialty || "کاردرمانگر", worksFor: { "@id": `${base}/#clinic` }, description: t.bio || undefined, image: t.avatar ? `${base}${t.avatar}` : undefined, knowsAbout: ["کاردرمانی", "توان‌بخشی"] };
  if (t.credentials) data.hasCredential = { "@type": "EducationalOccupationalCredential", name: t.credentials };
  if (t.licenseNo) data.identifier = { "@type": "PropertyValue", name: "شماره نظام", value: t.licenseNo };
  return data;
}

export function faqJsonLd(faq: { q: string; a: string }[]) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

export function serviceJsonLd(s: Settings, svc: { slug: string; title: string; shortDescription?: string | null; seoDescription?: string | null; coverImage?: string | null }) {
  const base = siteUrl(s);
  return { "@context": "https://schema.org", "@type": "MedicalTherapy", "@id": `${base}/services/${svc.slug}#service`, name: svc.title, url: `${base}/services/${svc.slug}`, description: svc.seoDescription || svc.shortDescription || undefined, image: svc.coverImage ? `${base}${svc.coverImage}` : `${base}/og.png`, provider: { "@id": `${base}/#clinic` }, areaServed: { "@type": "City", name: cityOf(s) }, availableService: undefined };
}

export function articleJsonLd(s: Settings, a: { slug: string; title: string; excerpt?: string | null; coverImage?: string | null; publishedAt?: string | null; updatedAt?: string | null; authorName?: string | null; type?: string; tags?: string[]; mediaUrl?: string | null; embedSrc?: string | null; duration?: string | null }) {
  const base = siteUrl(s);
  const url = `${base}/media/${encodeURIComponent(a.slug)}`;
  const img = a.coverImage ? `${base}${a.coverImage}` : `${base}/og.png`;
  const common = { "@context": "https://schema.org", "@id": `${url}#content`, headline: a.title, name: a.title, description: a.excerpt || undefined, image: img, url, mainEntityOfPage: url, datePublished: a.publishedAt || undefined, dateModified: a.updatedAt || a.publishedAt || undefined, author: a.authorName ? { "@type": "Person", name: a.authorName } : { "@id": `${base}/#clinic` }, publisher: { "@id": `${base}/#clinic` }, inLanguage: "fa", keywords: a.tags?.join(", ") || undefined };
  if (a.type === "VIDEO") return { ...common, "@type": "VideoObject", thumbnailUrl: img, uploadDate: a.publishedAt || undefined, embedUrl: a.embedSrc || undefined, contentUrl: a.mediaUrl ? `${base}${a.mediaUrl}` : undefined };
  if (a.type === "PODCAST") return { ...common, "@type": "PodcastEpisode", associatedMedia: a.mediaUrl ? { "@type": "MediaObject", contentUrl: `${base}${a.mediaUrl}` } : undefined };
  if (a.type === "BOOK") return { ...common, "@type": "Book" };
  return { ...common, "@type": "Article" };
}

/** یک بار خواندن تنظیمات و درمانگران برای صفحه‌های عمومی */
export async function publicContext() {
  const clinic = await getClinic();
  return { clinic, s: (clinic?.settings ?? {}) as Settings, therapists: clinic?.therapists ?? [] };
}
