import { Router } from "express";
import { z } from "zod";
import slugify from "slugify";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zOptionalString } from "../lib/validate.js";
import { notFound } from "../lib/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const articlesRouter = Router();

function makeSlug(title: string) {
  const base = slugify(title, { lower: true, strict: false, locale: "fa" }).replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return base || `article-${Date.now()}`;
}

const shape = (a: any) => ({ ...a, tags: parseJson<string[]>(a.tags, []), authorName: a.author ? `${a.author.firstName} ${a.author.lastName}` : null });
const include = { author: { select: { firstName: true, lastName: true } } } as const;

/** فهرست عمومی مقالات منتشرشده */
articlesRouter.get("/public", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const category = String(req.query.category ?? "");
  const where: any = { published: true };
  if (q) where.OR = [{ title: { contains: q } }, { excerpt: { contains: q } }, { content: { contains: q } }];
  if (category) where.category = category;
  const items = await prisma.article.findMany({ where, include, orderBy: { publishedAt: "desc" }, take: 100 });
  const cats = await prisma.article.findMany({ where: { published: true, category: { not: null } }, select: { category: true }, distinct: ["category"] });
  res.json({ items: items.map(shape), categories: cats.map((c) => c.category).filter(Boolean) });
});

articlesRouter.get("/public/:slug", async (req, res) => {
  const a = await prisma.article.findUnique({ where: { slug: String(req.params.slug) }, include });
  if (!a || !a.published) throw notFound("مقاله یافت نشد");
  await prisma.article.update({ where: { id: a.id }, data: { views: { increment: 1 } } });
  const related = await prisma.article.findMany({ where: { published: true, id: { not: a.id }, category: a.category ?? undefined }, include, orderBy: { publishedAt: "desc" }, take: 3 });
  res.json({ article: shape(a), related: related.map(shape) });
});

// مدیریت مقالات (مدیر و درمانگر)
articlesRouter.use(requireAuth, requireRole("ADMIN", "THERAPIST", "SECRETARY"));

const articleSchema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  excerpt: zOptionalString,
  content: z.string().min(1, "متن مقاله الزامی است"),
  coverImage: zOptionalString,
  category: zOptionalString,
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  slug: zOptionalString,
});

articlesRouter.get("/", async (_req, res) => {
  const items = await prisma.article.findMany({ include, orderBy: { updatedAt: "desc" } });
  res.json({ items: items.map(shape) });
});

articlesRouter.get("/:id", async (req, res) => {
  const a = await prisma.article.findUnique({ where: { id: String(req.params.id) }, include });
  if (!a) throw notFound("مقاله یافت نشد");
  res.json({ article: shape(a) });
});

articlesRouter.post("/", async (req, res) => {
  const body = validate(articleSchema, req.body);
  let slug = body.slug || makeSlug(body.title);
  if (await prisma.article.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const a = await prisma.article.create({
    data: { ...body, slug, tags: JSON.stringify(body.tags ?? []), published: !!body.published, publishedAt: body.published ? new Date() : null, authorId: req.user!.id },
    include,
  });
  res.status(201).json({ article: shape(a) });
});

articlesRouter.patch("/:id", async (req, res) => {
  const body = validate(articleSchema.partial(), req.body);
  const cur = await prisma.article.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound("مقاله یافت نشد");
  const data: any = { ...body };
  if (body.tags) data.tags = JSON.stringify(body.tags);
  if (body.slug) data.slug = body.slug;
  if (body.published && !cur.publishedAt) data.publishedAt = new Date();
  const a = await prisma.article.update({ where: { id: cur.id }, data, include });
  res.json({ article: shape(a) });
});

articlesRouter.delete("/:id", async (req, res) => {
  await prisma.article.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
