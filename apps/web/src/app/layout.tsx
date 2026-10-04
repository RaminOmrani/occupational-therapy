import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/auth";
import { getServerUser, getClinic } from "@/lib/server";
import { PwaRegister } from "@/components/layout/Pwa";
import { JsonLd, clinicJsonLd, websiteJsonLd, siteUrl, cleanName, trimDesc } from "@/lib/seo";

/** متادیتای پیش‌فرض کل سایت از تنظیمات پنل (سئو ← عنوان و توضیح صفحه اصلی، کدهای تأیید) */
export async function generateMetadata(): Promise<Metadata> {
  const clinic = await getClinic();
  const s = clinic?.settings ?? {};
  const base = siteUrl(s);
  const name = cleanName(s);
  const title = s["seo.homeTitle"] || `${name} | ${s["clinic.city"] || "مشهد"}`;
  const description = trimDesc(s["seo.homeDescription"] || s["clinic.about"] || "");
  return {
    metadataBase: new URL(base),
    title: { default: title, template: `%s | ${name}` },
    description,
    keywords: (s["seo.keywords"] ?? "").split(/[,،]/).map((k) => k.trim()).filter(Boolean),
    applicationName: "ذهن سبز",
    alternates: { canonical: base },
    openGraph: { type: "website", url: base, siteName: name, locale: "fa_IR", title, description, images: [{ url: `${base}/og.png`, width: 1200, height: 630, alt: name }] },
    twitter: { card: "summary_large_image", title, description, images: [`${base}/og.png`] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    verification: { google: s["seo.googleVerification"] || undefined, other: s["seo.bingVerification"] ? { "msvalidate.01": s["seo.bingVerification"] } : undefined },
    manifest: "/manifest.json",
    icons: { icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: "ذهن سبز", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { themeColor: "#0b5e2e", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, clinic] = await Promise.all([getServerUser(), getClinic()]);
  const s = clinic?.settings ?? {};
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* ثبت زودهنگام سرویس‌ورکر؛ به‌صورت اسکریپت مستقیم تا ابزارهایی مثل PWABuilder هم آن را تشخیص دهند */}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})})}" }} />
        <JsonLd data={[clinicJsonLd(s, clinic?.therapists ?? []), websiteJsonLd(s)]} />
      </head>
      <body className="min-h-screen">
        <Providers initialUser={user}>{children}<PwaRegister /></Providers>
      </body>
    </html>
  );
}
