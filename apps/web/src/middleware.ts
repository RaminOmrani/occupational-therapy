import { NextResponse, type NextRequest } from "next/server";

/**
 * - www. → بدون www (۳۰۱) تا آدرس canonical یکی باشد
 * - مسیرهای پنل فقط با کوکی ورود در دسترس‌اند؛ اعتبارسنجی واقعی توکن در API انجام می‌شود
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = req.nextUrl.clone();
    url.host = host.slice(4).replace(/:\d+$/, "");
    url.port = "";
    url.protocol = "https";
    return NextResponse.redirect(url, 301);
  }
  const token = req.cookies.get("ot_token")?.value;
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/panel") && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname === "/login" && token) {
    const url = req.nextUrl.clone();
    url.pathname = "/panel";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  if (pathname.startsWith("/panel") || pathname === "/login") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|icons/|uploads/|sw.js|manifest.json|favicon.ico).*)"] };
