import type { MetadataRoute } from "next";
import { serverGet } from "@/lib/api";
import { getClinic } from "@/lib/server";
import { siteUrl } from "@/lib/seo";

/** نقشه سایت خودکار: صفحات ثابت + خدمات + درمانگران + همه محتوای منتشرشده */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const clinic = await getClinic();
  const s = clinic?.settings ?? {};
  const base = siteUrl(s);
  const statics: MetadataRoute.Sitemap = [
    { url: `${base}`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/services`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/team`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/media`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/book`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/tests/sensory-profile`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/app`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  const services = (clinic?.services ?? []).map((sv) => ({ url: `${base}/services/${sv.slug}`, changeFrequency: "monthly" as const, priority: 0.9 }));
  const team = (clinic?.therapists ?? []).map((t) => ({ url: `${base}/team/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.7 }));
  const data = await serverGet<{ items: { slug: string; updatedAt: string }[] }>("/articles/public", 300);
  const media = (data?.items ?? []).map((a) => ({ url: `${base}/media/${encodeURIComponent(a.slug)}`, lastModified: new Date(a.updatedAt), changeFrequency: "monthly" as const, priority: 0.6 }));
  return [...statics, ...services, ...team, ...media];
}
