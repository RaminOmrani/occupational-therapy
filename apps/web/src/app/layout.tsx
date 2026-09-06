import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/auth";
import { getServerUser } from "@/lib/server";

export const metadata: Metadata = {
  title: { default: "کلینیک کاردرمانی ترنج", template: "%s | کلینیک کاردرمانی ترنج" },
  description: "کلینیک تخصصی کاردرمانی کودکان و بزرگسالان؛ ارزیابی دقیق، برنامه درمانی شخصی و پیگیری مستمر پیشرفت",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "کلینیک ترنج", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0f8b8d", width: "device-width", initialScale: 1, viewportFit: "cover" };

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
