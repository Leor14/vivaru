import { NextResponse, type NextRequest } from "next/server";

import { decodeSessionCookie, SESSION_COOKIE_KEY } from "@/lib/auth/session-cookie";
import { canAccessPath, routeByRole } from "@/lib/auth/routing";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const forcedPasswordPath = "/resident/change-password-required";
  const isDev = process.env.NODE_ENV !== "production";

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/registro") ||  // self-service: alta pública del trial
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/restablecer") ||
    pathname.startsWith("/activar") ||
    pathname.startsWith("/setup-error") ||
    pathname.startsWith("/unauthorized");

  const session = decodeSessionCookie(request.cookies.get(SESSION_COOKIE_KEY)?.value);

  if (pathname === "/" && session) {
    if (isDev) {
      console.info("[middleware] root-redirect", {
        role: session.role,
        mustChangePassword: session.mustChangePassword === true,
      });
    }
    return NextResponse.redirect(new URL(routeByRole(session.role), request.url));
  }

  if (isPublic) {
    return NextResponse.next();
  }

  const isProtected = pathname.startsWith("/superadmin") || pathname.startsWith("/admin") || pathname.startsWith("/resident") || pathname.startsWith("/guard");

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!session) {
    if (isDev) {
      console.info("[middleware] unauthenticated", { pathname });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(session.role, pathname)) {
    if (isDev) {
      console.info("[middleware] unauthorized", { pathname, role: session.role });
    }
    const unauthorizedUrl = new URL("/unauthorized", request.url);
    unauthorizedUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(unauthorizedUrl);
  }

  if (session.role === "resident" && session.mustChangePassword === true) {
    if (pathname !== forcedPasswordPath) {
      if (isDev) {
        console.info("[middleware] force-password-change", { pathname, mustChangePassword: true });
      }
      const forceChangeUrl = new URL(forcedPasswordPath, request.url);
      forceChangeUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(forceChangeUrl);
    }
  }

  if (session.role === "resident" && session.mustChangePassword !== true && pathname === forcedPasswordPath) {
    if (isDev) {
      console.info("[middleware] force-password-resolved", { pathname, mustChangePassword: false });
    }
    return NextResponse.redirect(new URL("/resident", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
