import { NextResponse } from "next/server";
import { SERVER_API_URL } from "@/lib/api";

/** تأیید مالکیت دامنه برای اپ اندروید (TWA)؛ محتوا از تنظیمات پنل خوانده می‌شود */
export async function GET() {
  try {
    const r = await fetch(`${SERVER_API_URL}/api/settings/public`, { cache: "no-store" });
    const raw = ((await r.json()).settings?.["app.assetlinks"] ?? "").trim();
    const body = raw ? JSON.parse(raw) : [];
    return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
