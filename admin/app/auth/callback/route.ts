import { NextResponse, type NextRequest } from "next/server";
import { sessionClient } from "@/lib/supabase.ts";

/** Retour du lien magique : échange le code contre une session en cookies, puis entre dans le back-office. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const target = request.nextUrl.clone();
  target.search = "";
  if (code) {
    const supabase = await sessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      target.pathname = "/images";
      return NextResponse.redirect(target);
    }
  }
  target.pathname = "/login";
  target.search = "?refused=1";
  return NextResponse.redirect(target);
}
