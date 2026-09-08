/**
 * /api/user — server-side persistence for the client AppProvider state.
 *
 * Enforces authenticated identity checks and payload limits.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import type { RoleId, User } from "@/lib/types";
import type { PersistedUserState } from "@/lib/store";

const COOKIE = "cf_uid";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();
    const email = authUser?.email || cookies().get(COOKIE)?.value;
    if (!email || !supabaseConfigured) {
      return NextResponse.json({ user: null, state: null });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, email, name, picture, auth_provider, target_role, state")
      .eq("email", email)
      .single();

    if (error || !data) return NextResponse.json({ user: null, state: null });

    const user: User = {
      name: data.name ?? "",
      email: data.email,
      picture: data.picture ?? undefined,
      authProvider: data.auth_provider ?? undefined,
      targetRole: (data.target_role as RoleId | null) ?? null,
      dbId: data.id,
    };
    return NextResponse.json({
      user,
      state: (data.state as PersistedUserState | null) ?? null,
    });
  } catch (err) {
    console.error("[api/user] GET error:", err);
    return NextResponse.json({ user: null, state: null, error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Payload too large. Maximum size is 1MB." }, { status: 413 });
    }

    const body = (await req.json()) as {
      user: User | null;
      state: PersistedUserState | null;
    };
    const { user, state } = body;

    if (!user?.email || typeof user.email !== "string" || !user.email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Valid user email is required" }, { status: 400 });
    }

    const existingAuthUser = await getAuthenticatedUser();
    // Authorization check: cannot update profile under another user's identity
    if (existingAuthUser && existingAuthUser.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Cannot modify another user's profile" },
        { status: 403 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, user.email, COOKIE_OPTS);

    if (supabaseConfigured) {
      const supabase = createSupabaseServerClient();
      const { error } = await supabase.from("users").upsert(
        {
          email: user.email,
          name: user.name ? user.name.slice(0, 100) : null,
          picture: user.picture ?? null,
          auth_provider: user.authProvider ?? "email",
          target_role: user.targetRole ?? null,
          state: state ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
      if (error) {
        console.error("[api/user] upsert error:", error.message);
        return NextResponse.json({ ok: false, error: "Database update error" }, { status: 500 });
      }
    }

    return res;
  } catch (err) {
    console.error("[api/user] PUT error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
  return res;
}
