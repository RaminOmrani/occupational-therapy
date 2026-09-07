import type { NextConfig } from "next";

// آدرس سرور API؛ در حالت توسعه نیازی به تنظیم نیست
const API_URL = process.env.API_URL ?? "http://127.0.0.1:4310";
// منطقه زمانی سرور رندر (تاریخ‌های شمسی در صفحات عمومی)
process.env.TZ = process.env.TZ || "Asia/Tehran";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // تایپ‌چک و لینت جداگانه (pnpm typecheck) انجام می‌شود؛ حذف از build برای سرورهای کم‌حافظه
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ["@toranj/shared"],
  webpack: (config) => {
    // پکیج مشترک با پسوند .js ایمپورت می‌کند (سازگار با Node ESM)؛ اینجا به فایل‌های .ts نگاشت می‌شود
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
  images: { remotePatterns: [{ protocol: "http", hostname: "localhost" }, { protocol: "https", hostname: "**" }] },
  async rewrites() {
    // مرورگر فقط با همین دامنه صحبت می‌کند؛ Next درخواست‌ها را به API پراکسی می‌کند (کوکی‌ها هم‌دامنه می‌مانند)
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
