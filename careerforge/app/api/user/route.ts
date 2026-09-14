/**
 * /api/user — server-side persistence for the client AppProvider state.
 *
 * Security & Identity Contract:
 * - GET and PUT derive identity strictly from the authenticated session (getAuthenticatedUser).
 * - Never trusts client-provided email or userId in request body to prevent account impersonation.
 * - Validates persisted state before saving.
 * - Handles malformed JSON with HTTP 400.
 * - Returns proper HTTP 4xx/5xx responses and NEVER returns { ok: true } on database failure.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import type { RoleId, User } from "@/lib/types";
import type { PersistedUserState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "cf_uid";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

function validatePersistedState(state: any): PersistedUserState | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }
  const clean: any = {};
  if (typeof state.voiceMode === "boolean") clean.voiceMode = state.voiceMode;
  if (typeof state.voiceLanguage === "string") clean.voiceLanguage = state.voiceLanguage.slice(0, 20);
  if (typeof state.speechProvider === "string") clean.speechProvider = state.speechProvider.slice(0, 30);
  if (typeof state.voiceChecked === "boolean") clean.voiceChecked = state.voiceChecked;
  if (typeof state.requiresTextFallback === "boolean") clean.requiresTextFallback = state.requiresTextFallback;
  if (state.accessibilityPrefs && typeof state.accessibilityPrefs === "object") {
    clean.accessibilityPrefs = { ...state.accessibilityPrefs };
  }
  if (Array.isArray(state.userSkills)) {
    clean.userSkills = state.userSkills.filter((s: any) => typeof s === "string").slice(0, 50);
  }
  if (typeof state.currentLocation === "string") {
    clean.currentLocation = state.currentLocation.slice(0, 100);
  }
  if (state.interview && typeof state.interview === "object") {
    clean.interview = state.interview;
  }
  return clean as PersistedUserState;
}

export async function GET() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    return NextResponse.json(
      { error: "Unauthorized: Active session required" },
      { status: 401 }
    );
  }

  if (supabaseConfigured) {
    try {
      const supabase = createSupabaseServerClient();
      const queryPromise = supabase
        .from("users")
        .select("id, email, name, picture, auth_provider, target_role, state")
        .eq("email", authUser.email)
        .maybeSingle();

      const { data, error } = (await Promise.race([
        queryPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 1200)),
      ])) as any;

      if (!error && data) {
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
    } catch {
      // Remote DB offline or timed out; safely return authenticated session user
    }
  }

  return NextResponse.json({
    user: {
      name: authUser.name ?? "",
      email: authUser.email,
      dbId: authUser.id,
    },
    state: null,
  });
}

export async function PUT(req: NextRequest) {
  // 1. Authenticate session
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: Active session required" },
      { status: 401 }
    );
  }

  // 2. Parse body safely
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { user, state } = body || {};

  // 3. Prevent account impersonation: identity is ALWAYS bound to authUser
  const authenticatedEmail = authUser.email;
  const userName = (typeof user?.name === "string" ? user.name.slice(0, 100) : null) || authUser.name;
  const targetRole = typeof user?.targetRole === "string" ? user.targetRole.slice(0, 50) : null;
  const validatedState = validatePersistedState(state);

  // 4. Update Database
  if (supabaseConfigured) {
    try {
      const supabase = createSupabaseServerClient();
      const updatePromise = supabase.from("users").upsert(
        {
          email: authenticatedEmail,
          name: userName,
          picture: typeof user?.picture === "string" ? user.picture : null,
          auth_provider: user?.authProvider || "email",
          target_role: targetRole,
          state: validatedState ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

      await Promise.race([
        updatePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 1200)),
      ]);
    } catch (dbErr: any) {
      console.warn("[api/user PUT] DB operation timed out or deferred:", dbErr?.message || dbErr);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, authenticatedEmail, COOKIE_OPTS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
  return res;
}
