import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPossibleDirectoryMount, SITE_RENDER_PREFIX } from "@/lib/website/routing";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth", "/verify", "/badges/verify", "/api/badges/verify", "/.well-known", SITE_RENDER_PREFIX];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  // A path whose first segment is not an application route may be a site's directory
  // mount, which must render for signed-out visitors. The route still enforces auth on
  // its non-site branch, so letting it through only defers the check.
  const isPublic = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))
    || isPossibleDirectoryMount(request.nextUrl.pathname);
  const isAuthenticated = Boolean(data?.claims?.sub);

  if (!isAuthenticated && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && ["/login", "/signup"].includes(request.nextUrl.pathname)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
