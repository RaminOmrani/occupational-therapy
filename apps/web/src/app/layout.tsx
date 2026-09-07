import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/auth";
import { getServerUser } from "@/lib/server";

export const metadata: Metadata = {
  title: { default: "کلینیک کاردرمانی ذهن سبز", template: "%s | کلینیک کاردرمانی ذهن سبز" },
  description: "کلینیک تخصصی کاردرمانی ذهن سبز مشهد؛ ارزیابی دقیق، برنامه درمانی شخصی و پیگیری مستمر پیشرفت",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "ذهن سبز", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#178a6e", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen">
        <Providers initialUser={user}>{children}</Providers>
      </body>
    </html>
  );
}
