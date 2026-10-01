import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/settings(.*)"]);
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const baseUrl = new URL(req.url);

  // Redirect authenticated users away from auth pages
  if (isAuthRoute(req) && userId) {
    return NextResponse.redirect(new URL("/dashboard", baseUrl));
  }

  // Protect dashboard routes - redirect to sign-in if not authenticated
  if (isProtectedRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", baseUrl).toString(),
    });
  }
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/cron (cron endpoints should not require auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/cron).*)",
  ],
};