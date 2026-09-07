// منطقه زمانی پیش‌فرض کلینیک (برای تاریخ شمسی، ساعت نوبت‌ها و زمان‌بندی پیامک‌ها)
process.env.TZ = process.env.TZ || "Asia/Tehran";

import { createApp } from "./app.js";
import { ensureDefaultSettings } from "./lib/settings.js";
import { ensureDefaultTemplates } from "./lib/sms/service.js";
import { getJwtSecret } from "./lib/auth.js";
import { startScheduler } from "./jobs/scheduler.js";
import { prisma } from "./lib/prisma.js";

async function main() {
  await ensureDefaultSettings();
  await ensureDefaultTemplates();
  await getJwtSecret();
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins === 0) console.warn("⚠️  هیچ مدیری تعریف نشده است. دستور `pnpm db:seed` را اجرا کنید.");
  const app = createApp();
  const port = Number(process.env.PORT ?? 4310);
  const host = process.env.HOST ?? "0.0.0.0";
  app.listen(port, host, () => {
    console.log(`🩺 API ready on http://${host}:${port}`);
    startScheduler();
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
