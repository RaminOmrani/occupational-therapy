import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { BACKUP_DIR, createBackup, listBackups } from "../lib/backup.js";
import { notFound, badRequest } from "../lib/errors.js";
import { audit } from "../lib/audit.js";

export const backupsRouter = Router();
backupsRouter.use(requireAuth, requireAdmin);

backupsRouter.get("/", (_req, res) => res.json({ items: listBackups(), dir: BACKUP_DIR }));
backupsRouter.post("/", async (req, res) => {
  const r = await createBackup("manual");
  await audit(req.user!.id, "backup", "system", r.file);
  res.status(201).json(r);
});
backupsRouter.get("/:file", (req, res) => {
  const file = path.basename(String(req.params.file));
  if (!/^clinic-[\w-]+\.db$/.test(file)) throw badRequest("نام فایل نامعتبر است");
  const full = path.join(BACKUP_DIR, file);
  if (!fs.existsSync(full)) throw notFound();
  res.download(full, file);
});
backupsRouter.delete("/:file", (req, res) => {
  const file = path.basename(String(req.params.file));
  if (!/^clinic-[\w-]+\.db$/.test(file)) throw badRequest("نام فایل نامعتبر است");
  fs.rmSync(path.join(BACKUP_DIR, file), { force: true });
  res.json({ ok: true });
});
