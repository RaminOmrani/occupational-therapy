import { NextResponse } from "next/server";
import { SERVER_API_URL } from "@/lib/api";

/**
 * تأیید مالکیت دامنه برای اپ اندروید (TWA)؛ محتوا از تنظیمات پنل خوانده می‌شود.
 * کافه‌بازار علاوه بر ورودی استاندارد android_app، برای هر بسته یک ورودی
 * check_validation با فضای نام cafebazaar_twa می‌خواهد؛ این ورودی خودکار اضافه می‌شود.
 */
export async function GET() {
  try {
    const r = await fetch(`${SERVER_API_URL}/api/settings/public`, { cache: "no-store" });
    const raw = ((await r.json()).settings?.["app.assetlinks"] ?? "").trim();
    const parsed = raw ? JSON.parse(raw) : [];
    const body: any[] = Array.isArray(parsed) ? parsed : [parsed];
    const packages = new Set<string>(body.filter((e) => e?.target?.namespace === "android_app" && e.target.package_name).map((e) => String(e.target.package_name)));
    const hasBazaar = new Set<string>(body.filter((e) => e?.target?.namespace === "cafebazaar_twa" && e.target.package_name).map((e) => String(e.target.package_name)));
    for (const pkg of packages) {
      if (!hasBazaar.has(pkg)) body.push({ relation: ["check_validation"], target: { namespace: "cafebazaar_twa", package_name: pkg } });
    }
    return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
