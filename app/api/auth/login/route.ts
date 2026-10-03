/**
 * POST /api/auth/login
 *
 * Unified Secure Authentication API for CareerForge:
 * - Handles sign in, sign up, and isolated guest exploration
 * - Zod validation for email format, password complexity, and required fields
 * - Generates cryptographically signed HMAC session tokens
 * - Eliminates shared accounts (e.g. Alex Rivera); guarantees isolated guest sessions
 * - Rate limited against brute-force and credential stuffing attacks
 * - Interfaces with database/Supabase user storage
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { upsertUser } from "@/lib/db";
import {
  createSignedSessionToken,
  generateIsolatedGuestIdentity,
  SESSION_CONFIG,
} from "@/lib/security/session";
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { createApiErrorResponse } from "@/lib/errors/apiError";

export const runtime = "nodejs";

const LoginRequestSchema = z.object({
  email: z.string().email("Please provide a valid email address.").optional(),
  password: z.string().min(6, "Password must be at least 6 characters.").optional(),
  name: z.string().min(2, "Name must be at least 2 characters.").optional(),
  mode: z.enum(["signin", "signup", "guest", "oauth", "phone"]).default("signin"),
  authProvider: z.string().optional(),
  picture: z.string().optional(),
  accessToken: z.string().optional(),
  idToken: z.string().optional(),
});

function extractDisplayName(email: string, name?: string): string {
  if (name && name.trim()) return name.trim();
  const username = email.split("@")[0] || "User";
  return username
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const clientIp = getClientIp(req);

  // 1. Rate Limiting (10 requests per minute per IP)
  const rateLimitResult = checkRateLimit(`auth:${clientIp}`, RATE_LIMIT_PRESETS.auth);
  if (rateLimitResult.isLimited) {
    return createApiErrorResponse(
      "RATE_LIMITED",
      "Too many login attempts. Please wait a minute before trying again.",
      requestId,
      { statusCode: 429, retryable: true }
    );
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return createApiErrorResponse("BAD_REQUEST", "Invalid JSON request payload.", requestId, {
        statusCode: 400,
      });
    }

    const parseResult = LoginRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0]?.message || "Invalid authentication parameters.";
      return createApiErrorResponse("BAD_REQUEST", firstIssue, requestId, {
        statusCode: 400,
        details: parseResult.error.format(),
      });
    }

    const { email, password, name, mode, authProvider, picture } = parseResult.data;

    // 2. Guest Mode: Isolated Unique Identity
    if (mode === "guest") {
      const guestIdentity = generateIsolatedGuestIdentity();
      const signedToken = createSignedSessionToken({
        userId: guestIdentity.userId,
        email: guestIdentity.email,
        name: guestIdentity.name,
        isGuest: true,
      });

      const guestUser = {
        id: guestIdentity.userId,
        name: guestIdentity.name,
        email: guestIdentity.email,
        authProvider: "guest",
        targetRole: "frontend",
        token: signedToken,
      };

      const res = NextResponse.json({
        success: true,
        message: "Welcome to CareerForge as Guest!",
        user: guestUser,
      });

      // Set tamper-proof cryptographically signed session cookie
      res.cookies.set(SESSION_CONFIG.cookieName, signedToken, SESSION_CONFIG.cookieOptions);
      // Set legacy cookie for backward compatibility
      res.cookies.set("cf_uid", guestIdentity.email, SESSION_CONFIG.cookieOptions);

      return res;
    }

    // 3. OAuth & Phone Mode: Authoritative Server Session Creation
    if (mode === "phone" || authProvider === "phone") {
      return createApiErrorResponse(
        "NOT_IMPLEMENTED",
        "Phone SMS OTP authentication is not configured in this environment. Please sign in with email or continue as Guest.",
        requestId,
        { statusCode: 501 }
      );
    }

    if (mode === "oauth") {
      const { accessToken, idToken } = parseResult.data;

      if (authProvider === "github") {
        return createApiErrorResponse(
          "NOT_IMPLEMENTED",
          "GitHub OAuth code exchange is not configured on this server. Please sign in with email or continue as Guest.",
          requestId,
          { statusCode: 501 }
        );
      }

      if (authProvider !== "google" && !accessToken && !idToken) {
        return createApiErrorResponse(
          "BAD_REQUEST",
          "Unsupported or unconfigured OAuth provider.",
          requestId,
          { statusCode: 400 }
        );
      }

      // Mandatory server-side token verification for Google OAuth
      if (!accessToken && !idToken) {
        return createApiErrorResponse(
          "UNAUTHORIZED",
          "Google OAuth requires a valid accessToken or idToken for server-side verification.",
          requestId,
          { statusCode: 401 }
        );
      }

      let verifiedEmail = "";
      let verifiedName = name;
      let verifiedPicture = picture;

      if (accessToken) {
        try {
          const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(6000),
          });
          if (!googleRes.ok) {
            return createApiErrorResponse(
              "UNAUTHORIZED",
              "Google OAuth token verification failed with provider.",
              requestId,
              { statusCode: 401 }
            );
          }
          const googleData = await googleRes.json();
          if (!googleData.email) {
            return createApiErrorResponse(
              "UNAUTHORIZED",
              "Google account did not return a verified email address.",
              requestId,
              { statusCode: 401 }
            );
          }
          verifiedEmail = String(googleData.email).trim().toLowerCase();
          verifiedName = googleData.name || verifiedName;
          verifiedPicture = googleData.picture || verifiedPicture;
        } catch {
          return createApiErrorResponse(
            "UNAUTHORIZED",
            "Google access token verification request failed or timed out.",
            requestId,
            { statusCode: 401 }
          );
        }
      } else if (idToken) {
        try {
          const tokeninfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
            signal: AbortSignal.timeout(6000),
          });
          if (!tokeninfoRes.ok) {
            return createApiErrorResponse(
              "UNAUTHORIZED",
              "Google ID token verification rejected by provider.",
              requestId,
              { statusCode: 401 }
            );
          }
          const tokenData = await tokeninfoRes.json();
          if (!tokenData.email) {
            return createApiErrorResponse(
              "UNAUTHORIZED",
              "Google ID token did not contain a verified email address.",
              requestId,
              { statusCode: 401 }
            );
          }
          verifiedEmail = String(tokenData.email).trim().toLowerCase();
          verifiedName = tokenData.name || verifiedName;
          verifiedPicture = tokenData.picture || verifiedPicture;
        } catch {
          return createApiErrorResponse(
            "UNAUTHORIZED",
            "Google ID token verification failed or timed out.",
            requestId,
            { statusCode: 401 }
          );
        }
      }

      // Ensure client-supplied email cannot spoof or mismatch the token-verified email
      if (email && email.trim().toLowerCase() !== verifiedEmail) {
        return createApiErrorResponse(
          "UNAUTHORIZED",
          "Supplied email does not match verified Google token identity.",
          requestId,
          { statusCode: 401 }
        );
      }

      const cleanEmail = verifiedEmail;
      const displayName = extractDisplayName(cleanEmail, verifiedName);
      let effectiveUserId = `usr_${crypto.createHash("sha256").update(cleanEmail).digest("hex").slice(0, 16)}`;

      try {
        const dbRow = await upsertUser({
          email: cleanEmail,
          name: displayName,
          authProvider: "google",
          picture: verifiedPicture,
        });
        if (dbRow?.id) effectiveUserId = dbRow.id;
      } catch (dbErr) {
        console.warn("[Auth API] DB upsert warning for google oauth:", dbErr);
      }

      const signedToken = createSignedSessionToken({
        userId: effectiveUserId,
        email: cleanEmail,
        name: displayName,
        isGuest: false,
      });

      const res = NextResponse.json({
        success: true,
        message: "Signed in successfully via verified Google OAuth",
        user: {
          id: effectiveUserId,
          name: displayName,
          email: cleanEmail,
          authProvider: "google",
          picture: verifiedPicture || null,
          token: signedToken,
        },
      });

      res.cookies.set(SESSION_CONFIG.cookieName, signedToken, SESSION_CONFIG.cookieOptions);
      res.cookies.set("cf_uid", cleanEmail, SESSION_CONFIG.cookieOptions);
      return res;
    }

    // 3. Regular Email Signin / Signup validation
    if (!email) {
      return createApiErrorResponse("BAD_REQUEST", "Please provide a valid email address.", requestId, {
        statusCode: 400,
      });
    }

    if (!password) {
      return createApiErrorResponse("BAD_REQUEST", "Password is required.", requestId, {
        statusCode: 400,
      });
    }

    if (mode === "signup" && (!name || name.trim().length < 2)) {
      return createApiErrorResponse(
        "BAD_REQUEST",
        "Please provide your full name (minimum 2 characters) for signup.",
        requestId,
        { statusCode: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    let displayName = extractDisplayName(cleanEmail, name);
    let effectiveUserId: string = "";

    // 4. Credential Verification & Authentication (Part 18)
    const { supabaseConfigured, supabase } = await import("@/lib/supabase");
    const {
      registerCredential,
      authenticateCredential,
      isEmailRegistered,
    } = await import("@/lib/security/credentials");

    if (mode === "signup") {
      let sbSuccess = false;
      if (supabaseConfigured && supabase) {
        try {
          const { data: sbData, error: sbErr } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: { data: { name: displayName } },
          });
          if (!sbErr && sbData.user) {
            effectiveUserId = sbData.user.id;
            sbSuccess = true;
          } else if (sbErr) {
            const msg = sbErr.message || "";
            if (msg.includes("already registered") || msg.includes("already exists")) {
              return createApiErrorResponse(
                "CONFLICT",
                "An account with this email address already exists. Please sign in.",
                requestId,
                { statusCode: 409 }
              );
            }
            if (!msg.includes("fetch failed") && !msg.includes("NetworkError")) {
              return createApiErrorResponse(
                "BAD_REQUEST",
                msg,
                requestId,
                { statusCode: 400 }
              );
            }
          }
        } catch {
          // Supabase network unreachable; fall back to local credential store
        }
      }

      if (!sbSuccess) {
        if (isEmailRegistered(cleanEmail)) {
          return createApiErrorResponse(
            "CONFLICT",
            "An account with this email address already exists. Please sign in.",
            requestId,
            { statusCode: 409 }
          );
        }
        effectiveUserId = `user_${crypto.createHash("sha256").update(cleanEmail).digest("hex").slice(0, 16)}`;
      }

      // Securely register salted password hash
      registerCredential({
        userId: effectiveUserId,
        email: cleanEmail,
        name: displayName,
        password,
      });
    } else {
      // mode === "signin"
      let authenticated = false;

      if (supabaseConfigured && supabase) {
        try {
          const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (!sbErr && sbData.user) {
            effectiveUserId = sbData.user.id;
            displayName = sbData.user.user_metadata?.name || displayName;
            authenticated = true;
          }
        } catch {
          // Fall back to local credential check
        }
      }

      if (!authenticated) {
        const cred = authenticateCredential(cleanEmail, password);
        if (!cred) {
          // Reject incorrect password or unregistered user
          return createApiErrorResponse(
            "UNAUTHORIZED",
            "Invalid email or password. If you haven't created an account yet, please switch to 'Create account'.",
            requestId,
            { statusCode: 401 }
          );
        }
        effectiveUserId = cred.userId;
        displayName = cred.name || displayName;
        authenticated = true;
      }
    }

    // 5. Record/Upsert User in Database (with fast timeout)
    let dbId: string | null = null;
    try {
      const dbPromise = upsertUser({
        email: cleanEmail,
        name: displayName,
        authProvider: "email",
        targetRole: undefined,
      });
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1200));
      const dbRow: any = await Promise.race([dbPromise, timeoutPromise]);
      if (dbRow?.id) {
        dbId = dbRow.id;
      }
    } catch (dbErr) {
      console.warn("[Auth API] Database recording note:", dbErr);
    }

    // 6. Create Cryptographically Signed Session Token
    const sessionToken = createSignedSessionToken({
      userId: effectiveUserId,
      email: cleanEmail,
      name: displayName,
      isGuest: false,
    });

    const userPayload = {
      id: effectiveUserId,
      name: displayName,
      email: cleanEmail,
      authProvider: "email",
      targetRole: null,
      dbId,
      token: sessionToken,
    };

    const res = NextResponse.json({
      success: true,
      message: mode === "signup" ? "Account created successfully!" : "Signed in successfully!",
      user: userPayload,
    });

    // Set secure cookies
    res.cookies.set(SESSION_CONFIG.cookieName, sessionToken, SESSION_CONFIG.cookieOptions);
    res.cookies.set("cf_uid", cleanEmail, SESSION_CONFIG.cookieOptions);

    return res;
  } catch (err: any) {
    console.error("[Auth API] Error:", err);
    return createApiErrorResponse("INTERNAL_ERROR", "An error occurred during authentication.", requestId, {
      statusCode: 500,
    });
  }
}
