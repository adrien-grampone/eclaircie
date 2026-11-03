import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, supabaseAnonKey, supabaseUrl } from "./lib/env.ts";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

/** Garde d'accès : session Supabase valide ET email dans ADMIN_EMAILS, sinon /login. */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const allowed = isAllowedEmail(data.user?.email);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (!allowed && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = data.user ? "?refused=1" : "";
    return NextResponse.redirect(url);
  }
  if (allowed && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/images";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
