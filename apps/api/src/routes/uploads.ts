import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireStaff, canAccessPatient } from "../middleware/auth.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { validate } from "../lib/validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_req, file, cb) => (ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(badRequest("فقط تصویر یا PDF مجاز است"))) });

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth, requireStaff);

/** آپلود عمومی (تصویر مقاله، آواتار) */
uploadsRouter.post("/", upload.single("file"), (req, res) => {
  if (!req.file) throw badRequest("فایلی ارسال نشد");
  res.status(201).json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype });
});

/** مدارک بیمار (عکس نسخه، گزارش پزشکی و...) */
uploadsRouter.post("/patients/:patientId/documents", upload.single("file"), async (req, res) => {
  if (!req.file) throw badRequest("فایلی ارسال نشد");
  const body = validate(z.object({ title: z.string().min(1).optional() }), req.body ?? {});
  const doc = await prisma.document.create({ data: { patientId: String(req.params.patientId), title: body.title || req.file.originalname, fileUrl: `/uploads/${req.file.filename}`, mimeType: req.file.mimetype, size: req.file.size } });
  res.status(201).json({ document: doc });
});

export const documentsRouter = Router();
documentsRouter.use(requireAuth);
documentsRouter.get("/patients/:patientId/documents", async (req, res) => {
  if (!canAccessPatient(req, String(req.params.patientId))) throw forbidden();
  const items = await prisma.document.findMany({ where: { patientId: String(req.params.patientId) }, orderBy: { createdAt: "desc" } });
  res.json({ items });
});
documentsRouter.delete("/documents/:id", requireStaff, async (req, res) => {
  const d = await prisma.document.findUnique({ where: { id: String(req.params.id) } });
  if (d) {
    await prisma.document.delete({ where: { id: d.id } });
    fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(d.fileUrl))).catch(() => null);
  }
  res.json({ ok: true });
});
