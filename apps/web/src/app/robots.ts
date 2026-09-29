import type { MetadataRoute } from "next";
import { getClinic } from "@/lib/server";
import { siteUrl } from "@/lib/seo";

/** پنل، ورود، API، فایل‌های آپلودی (مدارک مراجعین) و صفحات خصوصی ایندکس نمی‌شوند */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const clinic = await getClinic();
  const base = siteUrl(clinic?.settings ?? {});
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/panel", "/panel/", "/login", "/api/", "/uploads/", "/survey/", "/offline", "/articles"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
