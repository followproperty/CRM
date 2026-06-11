import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "./lib/session";

// Define routes that do not require auth
const publicRoutes = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and API check
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("session")?.value;
  const session = sessionCookie ? await decrypt(sessionCookie) : null;

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // 1. Redirect to /login if not authenticated and trying to access a private route
  if (!session && !isPublicRoute) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If authenticated...
  if (session) {
    // Redirect /login or root / to the role-specific dashboard
    if (pathname === "/login" || pathname === "/") {
      return NextResponse.redirect(new URL(getRoleDashboard(session.role), request.nextUrl.origin));
    }

    // Restrict access to other roles' dashboards
    const pathPrefix = pathname.split("/")[1];
    const allowedPrefix = getRolePrefix(session.role);

    if (pathPrefix && isDashboardPrefix(pathPrefix) && pathPrefix !== allowedPrefix) {
      return NextResponse.redirect(new URL(getRoleDashboard(session.role), request.nextUrl.origin));
    }
  }

  return NextResponse.next();
}

function getRolePrefix(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "super-admin";
    case "ADMIN":
      return "admin";
    case "CALLER":
      return "caller";
    case "DATA_ENTRY":
      return "data-entry";
    default:
      return "";
  }
}

function getRoleDashboard(role: string): string {
  const prefix = getRolePrefix(role);
  return prefix ? `/${prefix}` : "/login";
}

function isDashboardPrefix(prefix: string): boolean {
  return ["super-admin", "admin", "caller", "data-entry"].includes(prefix);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
