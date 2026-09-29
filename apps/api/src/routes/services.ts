import { Router } from "express";
import { z } from "zod";
import slugify from "slugify";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zOptionalString } from "../lib/validate.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { cleanHtml } from "./articles.js";
import { getSettingJson } from "../lib/settings.js";
import { DEFAULT_SERVICE_PAGES } from "../lib/serviceDefaults.js";

export const servicesRouter = Router();

const shape = (s: any) => ({ ...s, faq: parseJson<{ q: string; a: string }[]>(s.faq, []), keywords: (s.keywords ?? "").split(/[,،]/).map((k: string) => k.trim()).filter(Boolean) });
const pub = { where: { published: true }, orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] };

/** فهرست عمومی خدمات (برای منو، فوتر، صفحه خدمات و نقشه سایت) */
servicesRouter.get("/public", async (_req, res) => {
  const items = await prisma.service.findMany({ ...pub, select: { id: true, slug: true, title: true, shortDescription: true, icon: true, coverImage: true, updatedAt: true } });
  res.json({ items });
});

servicesRouter.get("/public/:slug", async (req, res) => {
  const s = await prisma.service.findUnique({ where: { slug: String(req.params.slug) }, include: { articles: { where: { published: true }, select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, type: true, publishedAt: true, authorLabel: true, author: { select: { firstName: true, lastName: true } } }, orderBy: { publishedAt: "desc" }, take: 6 } } });
  if (!s || !s.published) throw notFound("خدمت یافت نشد");
  const others = await prisma.service.findMany({ ...pub, where: { published: true, id: { not: s.id } }, select: { slug: true, title: true, shortDescription: true, icon: true } });
  res.json({ service: shape(s), others, articles: s.articles.map((a) => ({ ...a, authorName: a.authorLabel || (a.author ? `${a.author.firstName} ${a.author.lastName}` : null) })) });
});

servicesRouter.use(requireAuth, requireRole("ADMIN"));

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  slug: zOptionalString,
  shortDescription: zOptionalString,
  content: z.string().optional(),
  audience: zOptionalString,
  process: zOptionalString,
  faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  icon: zOptionalString,
  coverImage: zOptionalString,
  seoTitle: zOptionalString,
  seoDescription: zOptionalString,
  keywords: zOptionalString,
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
});

function makeSlug(title: string) {
  const base = slugify(title, { lower: true, strict: false, locale: "fa" }).replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return base || `service-${Date.now()}`;
}
function prep(body: Partial<z.infer<typeof schema>>) {
  const d: any = { ...body };
  if (body.content !== undefined) d.content = cleanHtml(body.content);
  if (body.audience !== undefined && body.audience) d.audience = cleanHtml(body.audience);
  if (body.process !== undefined && body.process) d.process = cleanHtml(body.process);
  if (body.faq) d.faq = JSON.stringify(body.faq);
  if (body.slug !== undefined) { if (body.slug && !/^[a-z0-9-]+$/.test(body.slug)) throw badRequest("نامک فقط حروف انگلیسی کوچک، عدد و خط تیره"); if (!body.slug) delete d.slug; }
  return d;
}

servicesRouter.get("/", async (_req, res) => {
  const items = await prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  res.json({ items: items.map(shape) });
});
servicesRouter.get("/:id", async (req, res) => {
  const s = await prisma.service.findUnique({ where: { id: String(req.params.id) } });
  if (!s) throw notFound("خدمت یافت نشد");
  res.json({ service: shape(s) });
});
servicesRouter.post("/", async (req, res) => {
  const body = validate(schema, req.body);
  let slug = body.slug || makeSlug(body.title);
  if (await prisma.service.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const s = await prisma.service.create({ data: { ...prep(body), slug, faq: JSON.stringify(body.faq ?? []), published: body.published ?? true } });
  res.status(201).json({ service: shape(s) });
});
servicesRouter.patch("/:id", async (req, res) => {
  const body = validate(schema.partial(), req.body);
  const cur = await prisma.service.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound("خدمت یافت نشد");
  const s = await prisma.service.update({ where: { id: cur.id }, data: prep(body) });
  res.json({ service: shape(s) });
});
servicesRouter.delete("/:id", async (req, res) => {
  await prisma.service.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

/** اگر جدول خدمات خالی است، از فهرست خدمات تنظیمات (clinic.services) ساخته می‌شود */
export async function ensureServices() {
  if ((await prisma.service.count()) > 0) return;
  const fromSettings = await getSettingJson<{ title: string; description: string; icon: string }[]>("clinic.services", []);
  let i = 0;
  for (const sv of fromSettings) {
    const def = DEFAULT_SERVICE_PAGES.find((d) => d.title === sv.title);
    const slug = def?.slug ?? makeSlug(sv.title);
    await prisma.service.upsert({
      where: { slug },
      update: {},
      create: { slug, title: sv.title, shortDescription: sv.description, icon: sv.icon, content: def?.content ?? `<p>${sv.description}</p>`, audience: def?.audience ?? null, process: def?.process ?? null, faq: JSON.stringify(def?.faq ?? []), seoTitle: def?.seoTitle ?? null, seoDescription: def?.seoDescription ?? null, keywords: def?.keywords ?? null, sortOrder: i++ },
    });
  }
}
