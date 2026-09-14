/**
 * /api/user — server-side persistence for the client AppProvider state
 * (user profile + voice/accessibility/session prefs).
 *
 * Identity (audit finding C1): resolved ONLY from the verified Supabase session
 * (`getAuthenticatedUser()` → `supabase.auth.getUser()`, which revalidates the
 * JWT server-side). The request body is never consulted for who the caller is.
 * A signed `cf_uid` cookie is issued as a fast-path session token and is only
 * minted after that verification; `verifySessionCookie()` rejects any forged or
 * stale value.
 *
 *   GET    → { user: User | null, state: PersistedUserState | null }
 *   PUT    { state } → persists the caller's state, (re)issues the signed cookie
 *   DELETE → signs out (clears the cookie + the Supabase session)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  signSessionCookie,
  verifySessionCookie,
} from "@/lib/session";
import type { RoleId, User } from "@/lib/types";
import type { PersistedUserState } from "@/lib/store";

/** The caller's verified email: a live Supabase session, or a cookie we signed after one. */
async function resolveEmail(): Promise<string | null> {
  const live = await getAuthenticatedUser();
  if (live?.email) return live.email;
  return verifySessionCookie(cookies().get(SESSION_COOKIE_NAME)?.value)?.email ?? null;
}

export async function GET() {
  const email = await resolveEmail();
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
  // Identity strictly from the verified server-side session — never the body.
  const session = await getAuthenticatedUser();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: { state?: PersistedUserState | null };
  try {
    body = (await req.json()) as { state?: PersistedUserState | null };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  // (Re)issue the signed session cookie, bound to the VERIFIED email.
  res.cookies.set(
    SESSION_COOKIE_NAME,
    signSessionCookie({ email: session.email }),
    SESSION_COOKIE_OPTIONS
  );

  if (supabaseConfigured) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("users").upsert(
      {
        email: session.email,
        state: (body.state as PersistedUserState) ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
    if (error) {
      console.error("[api/user] upsert error:", error.message);
      return NextResponse.json({ error: "Could not persist state" }, { status: 500 });
    }
  }

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  try {
    await createSupabaseServerClient().auth.signOut();
  } catch {
    // no active session — nothing to sign out
  }
  return res;
}
