import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { APP } from "@/lib/app";
import { SESSION_COOKIE } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const isLogin = pathname === "/login";

  if (!session && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session && (isLogin || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = APP.home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
