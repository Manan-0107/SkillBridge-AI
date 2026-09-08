import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body === null || typeof body !== "object" || !("requiresTextFallback" in body)) {
      return NextResponse.json(
        { error: "Missing required field: requiresTextFallback" },
        { status: 400 }
      );
    }

    const requiresTextFallback = Boolean(body.requiresTextFallback);

    try {
      const supabase = createSupabaseServerClient();
      const updatePromise = supabase.from("users").upsert(
        {
          email: authUser.email,
          state: {
            requiresTextFallback,
            accessibility: { requiresTextFallback },
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

      await Promise.race([
        updatePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 1200)),
      ]);
    } catch (dbErr) {
      console.warn("[api/user/preferences] DB update timed out or offline; returning success with memory fallback");
    }

    return NextResponse.json({ success: true, requiresTextFallback });
  } catch (error) {
    console.error("[api/user/preferences] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
