import { NextResponse } from "next/server";
import { SESSION_CONFIG } from "@/lib/security/session";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

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
