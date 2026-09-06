import { NextResponse, type NextRequest } from "next/server";

/** مسیرهای پنل فقط با کوکی ورود در دسترس‌اند؛ اعتبارسنجی واقعی توکن در API انجام می‌شود */
export function middleware(req: NextRequest) {
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
  return NextResponse.next();
}

export const config = { matcher: ["/panel/:path*", "/login"] };
