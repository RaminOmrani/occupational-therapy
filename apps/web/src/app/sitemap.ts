import type { MetadataRoute } from "next";
import { serverGet } from "@/lib/api";

/** نقشه سایت برای گوگل: صفحات ثابت + همه محتوای منتشرشده */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL || (await serverGet<{ settings: Record<string, string> }>("/public/clinic", 300))?.settings?.["site.baseUrl"] || "https://zehnesabz.com").replace(/\/$/, "");
  const statics = ["", "/about", "/media", "/book", "/app", "/contact", "/privacy"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 }));
  const data = await serverGet<{ items: { slug: string; updatedAt: string }[] }>("/articles/public", 300);
  const media = (data?.items ?? []).map((a) => ({ url: `${base}/media/${encodeURIComponent(a.slug)}`, lastModified: new Date(a.updatedAt), changeFrequency: "monthly" as const, priority: 0.6 }));
  return [...statics, ...media];
}
