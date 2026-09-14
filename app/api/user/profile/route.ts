import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({
        user: {
          id: "anonymous",
          email: "",
          name: null,
          image: null,
          requiresTextFallback: false,
        },
      });
    }

    const supabase = createSupabaseServerClient();
    const { data: userProfile } = await supabase
      .from("users")
      .select("id, email, name, picture, requires_text_fallback")
      .eq("id", userId)
      .single();

    return NextResponse.json({
      user: {
        id: userProfile?.id ?? userId,
        email: userProfile?.email ?? "",
        name: userProfile?.name ?? null,
        image: userProfile?.picture ?? null,
        requiresTextFallback: userProfile?.requires_text_fallback ?? false,
      },
    });
  } catch (error) {
    console.error("[api/user/profile] Error:", error);
    return NextResponse.json(
      {
        user: {
          id: "fallback",
          email: "",
          name: null,
          image: null,
          requiresTextFallback: false,
        },
      },
      { status: 200 }
    );
  }
}
