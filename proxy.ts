import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isAppHost, normalizeHost, SITE_HEADER, SITE_RENDER_PREFIX } from "@/lib/website/routing";

export async function proxy(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host") ?? "");
  const { pathname } = request.nextUrl;

  // Traffic arriving on a hostname the application does not answer on is website-builder
  // traffic. The site is resolved in the render route, not here — proxy must stay free
  // of data fetching.
  if (host && !isAppHost(host) && !pathname.startsWith("/api") && !pathname.startsWith(SITE_RENDER_PREFIX)) {
    const url = request.nextUrl.clone();
    url.pathname = `${SITE_RENDER_PREFIX}/${host}${pathname === "/" ? "" : pathname}`;
    const headers = new Headers(request.headers);
    headers.set(SITE_HEADER, "1");
    return NextResponse.rewrite(url, { request: { headers } });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
