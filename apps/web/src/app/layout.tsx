import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/auth";
import { getServerUser } from "@/lib/server";
import { PwaRegister } from "@/components/layout/Pwa";

export const metadata: Metadata = {
  title: { default: "کلینیک کاردرمانی ذهن سبز", template: "%s | کلینیک کاردرمانی ذهن سبز" },
  description: "کلینیک تخصصی کاردرمانی ذهن سبز مشهد؛ ارزیابی دقیق، برنامه درمانی شخصی و پیگیری مستمر پیشرفت",
  manifest: "/manifest.json",
  icons: { icon: [{ url: "/icons/favicon-32.png", sizes: "32x32" }, { url: "/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "ذهن سبز", statusBarStyle: "default" },
  applicationName: "ذهن سبز",
};

export const viewport: Viewport = { themeColor: "#178a6e", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* ثبت زودهنگام سرویس‌ورکر؛ به‌صورت اسکریپت مستقیم تا ابزارهایی مثل PWABuilder هم آن را تشخیص دهند */}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})})}" }} />
      </head>
      <body className="min-h-screen">
        <Providers initialUser={user}>{children}<PwaRegister /></Providers>
      </body>
    </html>
  );
}
