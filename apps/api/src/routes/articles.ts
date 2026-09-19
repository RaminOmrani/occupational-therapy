import { Router } from "express";
import { z } from "zod";
import slugify from "slugify";
import sanitizeHtml from "sanitize-html";
import { prisma, parseJson } from "../lib/prisma.js";
import { validate, zOptionalString } from "../lib/validate.js";
import { notFound, badRequest } from "../lib/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const articlesRouter = Router();

export const CONTENT_TYPES = ["ARTICLE", "VIDEO", "PODCAST", "BOOK"] as const;

function makeSlug(title: string) {
  const base = slugify(title, { lower: true, strict: false, locale: "fa" }).replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return base || `article-${Date.now()}`;
}

/** پاک‌سازی HTML ویرایشگر: فقط تگ‌ها و استایل‌های امن (فونت، اندازه، رنگ، تراز، جدول، تصویر، ویدیو، آپارات/یوتیوب) */
const EMBED_HOSTS = [/^https:\/\/(www\.)?aparat\.com\//, /^https:\/\/(www\.)?youtube\.com\/embed\//, /^https:\/\/(www\.)?youtube-nocookie\.com\/embed\//, /^https:\/\/player\.vimeo\.com\//];
export function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "iframe", "video", "audio", "source", "figure", "figcaption", "span", "u", "s", "mark", "sub", "sup", "h1", "h2", "hr", "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col"],
    allowedAttributes: {
      "*": ["style", "dir", "class", "data-*", "id"],
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
      video: ["src", "controls", "poster", "width", "height", "preload", "playsinline"],
      audio: ["src", "controls", "preload"],
      source: ["src", "type"],
      td: ["colspan", "rowspan", "colwidth"],
      th: ["colspan", "rowspan", "colwidth"],
      col: ["style", "width"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowedStyles: {
      "*": {
        "font-size": [/^\d+(\.\d+)?(px|em|rem|pt|%)$/],
        "font-family": [/^[\w\s,'"\-؀-ۿ]+$/],
        "font-weight": [/^(bold|normal|\d{3})$/],
        "font-style": [/^(italic|normal)$/],
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s,.%]+\)$/, /^[a-z]+$/],
        "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s,.%]+\)$/, /^[a-z]+$/],
        "text-align": [/^(right|left|center|justify|start|end)$/],
        "line-height": [/^[\d.]+(px|em|rem|%)?$/],
        direction: [/^(rtl|ltr)$/],
        width: [/^\d+(\.\d+)?(px|%)$/],
        height: [/^\d+(\.\d+)?(px|%)$/],
        "text-decoration": [/^(underline|line-through|none)$/],
        "margin-left": [/^(auto|\d+(px|%))$/], "margin-right": [/^(auto|\d+(px|%))$/],
        float: [/^(left|right|none)$/],
      },
    },
    exclusiveFilter: (frame) => frame.tag === "iframe" && !EMBED_HOSTS.some((r) => r.test(String(frame.attribs.src ?? ""))),
  });
}

/** لینک صفحه آپارات/یوتیوب → آدرس embed */
export function toEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  let m = u.match(/aparat\.com\/v\/([A-Za-z0-9]+)/) || u.match(/aparat\.com\/video\/video\/embed\/videohash\/([A-Za-z0-9]+)/);
  if (m) return `https://www.aparat.com/video/video/embed/videohash/${m[1]}/vt/frame`;
  m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  if (/^https:\/\/(www\.)?aparat\.com\//.test(u) || /^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//.test(u)) return u;
  return null;
}

const shape = (a: any) => ({ ...a, tags: parseJson<string[]>(a.tags, []), embedSrc: toEmbedUrl(a.embedUrl), authorName: a.authorLabel || (a.author ? `${a.author.firstName} ${a.author.lastName}` : null), isInternal: !a.authorLabel });
const include = { author: { select: { firstName: true, lastName: true } } } as const;

/** فهرست عمومی محتوای منتشرشده (مقاله/ویدیو/پادکست/کتاب) */
articlesRouter.get("/public", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const category = String(req.query.category ?? "");
  const type = String(req.query.type ?? "").toUpperCase();
  const where: any = { published: true };
  if (q) where.OR = [{ title: { contains: q } }, { excerpt: { contains: q } }, { content: { contains: q } }, { authorLabel: { contains: q } }];
  if (category) where.category = category;
  if (CONTENT_TYPES.includes(type as any)) where.type = type;
  const [items, cats, counts] = await Promise.all([
    prisma.article.findMany({ where, include, orderBy: [{ featured: "desc" }, { publishedAt: "desc" }], take: 200 }),
    prisma.article.findMany({ where: { published: true, category: { not: null } }, select: { category: true }, distinct: ["category"] }),
    prisma.article.groupBy({ by: ["type"], where: { published: true }, _count: { _all: true } }),
  ]);
  res.json({ items: items.map(shape), categories: cats.map((c) => c.category).filter(Boolean), counts: Object.fromEntries(counts.map((c) => [c.type, c._count._all])) });
});

articlesRouter.get("/public/:slug", async (req, res) => {
  const a = await prisma.article.findUnique({ where: { slug: String(req.params.slug) }, include });
  if (!a || !a.published) throw notFound("محتوا یافت نشد");
  await prisma.article.update({ where: { id: a.id }, data: { views: { increment: 1 } } });
  const related = await prisma.article.findMany({ where: { published: true, id: { not: a.id }, OR: [{ type: a.type }, { category: a.category ?? undefined }] }, include, orderBy: { publishedAt: "desc" }, take: 3 });
  res.json({ article: shape(a), related: related.map(shape) });
});

// مدیریت محتوا (مدیر، درمانگر، منشی)
articlesRouter.use(requireAuth, requireRole("ADMIN", "THERAPIST", "SECRETARY"));

const articleSchema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  excerpt: zOptionalString,
  content: z.string().default(""),
  format: z.enum(["markdown", "html"]).optional(),
  type: z.enum(CONTENT_TYPES).optional(),
  coverImage: zOptionalString,
  category: zOptionalString,
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  slug: zOptionalString,
  mediaUrl: zOptionalString,
  embedUrl: zOptionalString,
  fileUrl: zOptionalString,
  externalUrl: zOptionalString,
  duration: zOptionalString,
  authorLabel: zOptionalString,
  sourceName: zOptionalString,
});

function prepare(body: Partial<z.infer<typeof articleSchema>>) {
  const data: any = { ...body };
  if (body.content !== undefined && (body.format ?? "html") === "html") data.content = cleanHtml(body.content);
  if (body.embedUrl !== undefined && body.embedUrl && !toEmbedUrl(body.embedUrl)) throw badRequest("لینک ویدیو باید از آپارات یا یوتیوب باشد");
  if (body.tags) data.tags = JSON.stringify(body.tags);
  return data;
}

articlesRouter.get("/", async (req, res) => {
  const type = String(req.query.type ?? "").toUpperCase();
  const where: any = {};
  if (CONTENT_TYPES.includes(type as any)) where.type = type;
  const items = await prisma.article.findMany({ where, include, orderBy: { updatedAt: "desc" } });
  res.json({ items: items.map(shape) });
});

articlesRouter.get("/:id", async (req, res) => {
  const a = await prisma.article.findUnique({ where: { id: String(req.params.id) }, include });
  if (!a) throw notFound("محتوا یافت نشد");
  res.json({ article: shape(a) });
});

articlesRouter.post("/", async (req, res) => {
  const body = validate(articleSchema, req.body);
  let slug = body.slug || makeSlug(body.title);
  if (await prisma.article.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const data = prepare(body);
  const a = await prisma.article.create({
    data: { ...data, slug, format: body.format ?? "html", type: body.type ?? "ARTICLE", tags: JSON.stringify(body.tags ?? []), published: !!body.published, featured: !!body.featured, publishedAt: body.published ? new Date() : null, authorId: req.user!.id },
    include,
  });
  res.status(201).json({ article: shape(a) });
});

articlesRouter.patch("/:id", async (req, res) => {
  const body = validate(articleSchema.partial(), req.body);
  const cur = await prisma.article.findUnique({ where: { id: String(req.params.id) } });
  if (!cur) throw notFound("محتوا یافت نشد");
  const data = prepare({ ...body, format: body.format ?? (cur.format as any) });
  if (body.slug) data.slug = body.slug;
  if (body.published && !cur.publishedAt) data.publishedAt = new Date();
  const a = await prisma.article.update({ where: { id: cur.id }, data, include });
  res.json({ article: shape(a) });
});

articlesRouter.delete("/:id", async (req, res) => {
  await prisma.article.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
