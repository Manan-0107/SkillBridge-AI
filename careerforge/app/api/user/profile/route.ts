import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let userState: Record<string, any> = {};
    let dbUser: any = null;

    try {
      const supabase = createSupabaseServerClient();
      const queryPromise = supabase
        .from("users")
        .select("id, email, name, picture, state")
        .eq("email", authUser.email)
        .maybeSingle();

      const res = (await Promise.race([
        queryPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 1200)),
      ])) as any;

      if (!res?.error && res?.data) {
        dbUser = res.data;
        if (typeof dbUser.state === "object" && dbUser.state !== null) {
          userState = dbUser.state;
        }
      }
    } catch (dbErr) {
      console.warn("[api/user/profile] DB query timed out or offline, returning authenticated user defaults");
    }

    const requiresTextFallback = Boolean(
      userState.requiresTextFallback ?? userState.accessibility?.requiresTextFallback ?? false
    );

    return NextResponse.json({
      user: {
        id: dbUser?.id ?? authUser.id,
        email: dbUser?.email ?? authUser.email,
        name: dbUser?.name ?? authUser.name ?? null,
        image: dbUser?.picture ?? null,
        requiresTextFallback,
      },
    });
  } catch (error) {
    console.error("[api/user/profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
