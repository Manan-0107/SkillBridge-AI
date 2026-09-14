/**
 * /api/user — server-side persistence for the client AppProvider state that
 * used to live in localStorage (user profile + voice/accessibility/session prefs).
 *
 * Identity: an httpOnly `cf_uid` cookie holding the user's email, set on PUT and
 * cleared on DELETE. All non-identity state is stored in the `users.state` jsonb
 * column (see the migration note in lib/db.ts).
 *
 *   GET    → { user: User | null, state: PersistedUserState | null }
 *   PUT    { user, state } → upserts the row, (re)sets the cookie
 *   DELETE → signs out (clears the cookie)
 *
 * ponytail: single jsonb blob for prefs, split into real columns only if a
 * query ever needs to filter on one of them.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const email = cookies().get(COOKIE)?.value;
  if (!email || !supabaseConfigured) {
    return NextResponse.json({ user: null, state: null });
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("users")
    .select("id, email, name, picture, auth_provider, target_role, state")
    .eq("email", email)
    .single();

  if (!data) return NextResponse.json({ user: null, state: null });

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
}

export async function PUT(req: NextRequest) {
  const { user, state } = (await req.json()) as {
    user: User | null;
    state: PersistedUserState | null;
  };

  const res = NextResponse.json({ ok: true });
  if (!user?.email) return res;

  res.cookies.set(COOKIE, user.email, COOKIE_OPTS);

  if (supabaseConfigured) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("users").upsert(
      {
        email: user.email,
        name: user.name ?? null,
        picture: user.picture ?? null,
        auth_provider: user.authProvider ?? "email",
        target_role: user.targetRole ?? null,
        state: state ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
    if (error) console.error("[api/user] upsert error:", error.message);
  }

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
  return res;
}
