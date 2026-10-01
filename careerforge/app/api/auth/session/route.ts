import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/auth/session
 * Returns the cryptographically verified server-side session.
 * Never trusts client-side localStorage or spoofed cookies.
 */
export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name || null,
        isGuest: Boolean(authUser.isGuest),
      },
    });
  } catch (error) {
    console.error("[Session API Error]:", error);
    return NextResponse.json(
      { authenticated: false, error: "Internal session error" },
      { status: 500 }
    );
  }
}
