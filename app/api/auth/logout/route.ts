import { NextResponse } from "next/server";
import { SESSION_CONFIG } from "@/lib/security/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  try {
    const supabaseServer = createSupabaseServerClient();
    await supabaseServer.auth.signOut();
  } catch {
    // Supabase unconfigured or offline; handled gracefully
  }

  res.cookies.set(SESSION_CONFIG.cookieName, "", {
    ...SESSION_CONFIG.cookieOptions,
    maxAge: 0,
  });

  res.cookies.set("cf_uid", "", {
    ...SESSION_CONFIG.cookieOptions,
    maxAge: 0,
  });

  return res;
}
