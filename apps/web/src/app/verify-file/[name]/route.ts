import { SERVER_API_URL } from "@/lib/api";

/**
 * روش «بارگذاری فایل» برای تأیید مالکیت دامنه (اینماد و ...).
 * فایل‌ها در تنظیمات سئو ثبت می‌شوند و middleware آدرس /<نام فایل> را به اینجا می‌فرستد.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  let raw = "";
  try {
    // بدون کش تا بلافاصله بعد از ذخیره در پنل قابل تأیید باشد
    const r = await fetch(`${SERVER_API_URL}/api/settings/public`, { cache: "no-store" });
    raw = ((await r.json()).settings?.["seo.verificationFiles"] ?? "") as string;
  } catch { /* API در دسترس نیست */ }
  const lines = raw.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const [file, ...rest] = line.split("|");
    if (file.trim().replace(/^\/+/, "") === name) {
      const isHtml = /\.html?$/i.test(name);
      return new Response(rest.join("|").trim(), { status: 200, headers: { "content-type": `${isHtml ? "text/html" : "text/plain"}; charset=utf-8`, "cache-control": "no-store" } });
    }
  }
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}
