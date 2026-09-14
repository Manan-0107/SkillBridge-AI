import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const requiresTextFallback = Boolean(body.requiresTextFallback);

    const userId = await getAuthenticatedUserId();
    if (userId) {
      const supabase = createSupabaseServerClient();
      await supabase
        .from("users")
        .update({
          requires_text_fallback: requiresTextFallback,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    return NextResponse.json({ success: true, requiresTextFallback });
  } catch (error) {
    console.error("[api/user/preferences] Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
