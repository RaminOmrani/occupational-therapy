import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./prisma.js";
import { getSettingBool, getSettingNumber } from "./settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKUP_DIR = path.resolve(__dirname, "../../backups");
fs.mkdirSync(BACKUP_DIR, { recursive: true });

/** نسخه پشتیبان سازگار از دیتابیس SQLite با VACUUM INTO (بدون قفل‌کردن سرویس) */
export async function createBackup(label = "auto"): Promise<{ file: string; size: number }> {
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const file = `clinic-${stamp}-${label}.db`;
  const full = path.join(BACKUP_DIR, file);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${full.replace(/'/g, "''")}'`);
  const size = fs.statSync(full).size;
  await pruneBackups();
  return { file, size };
}

export async function pruneBackups() {
  const keep = Math.max(1, await getSettingNumber("backup.keep", 14));
  const files = listBackups();
  for (const f of files.slice(keep)) fs.rmSync(path.join(BACKUP_DIR, f.file), { force: true });
}

export function listBackups() {
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".db"))
    .map((file) => { const st = fs.statSync(path.join(BACKUP_DIR, file)); return { file, size: st.size, createdAt: st.mtime }; })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function scheduledBackup() {
  if (!(await getSettingBool("backup.enabled", true))) return;
  try {
    const r = await createBackup("auto");
    console.log(`💾 backup created: ${r.file} (${Math.round(r.size / 1024)} KB)`);
  } catch (e) {
    console.error("backup failed", e);
  }
}
