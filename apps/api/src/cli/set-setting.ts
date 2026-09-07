/** تنظیم یک مقدار از خط فرمان: pnpm --filter @toranj/api set-setting site.baseUrl https://example.ir */
process.env.TZ = process.env.TZ || "Asia/Tehran";
import { prisma } from "../lib/prisma.js";
import { ensureDefaultSettings, setSetting, getSetting } from "../lib/settings.js";

const [key, ...rest] = process.argv.slice(2);
const value = rest.join(" ");
if (!key) {
  console.error("usage: set-setting <key> <value>");
  process.exit(1);
}
await ensureDefaultSettings();
if (!value) console.log(`${key} = ${await getSetting(key)}`);
else {
  await setSetting(key, value);
  console.log(`✔ ${key} = ${value}`);
}
await prisma.$disconnect();
