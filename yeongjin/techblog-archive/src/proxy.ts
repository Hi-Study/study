import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isCron = pathname.startsWith("/api/cron");

  if (isApiAuth || isCron) return;

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/explore", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
