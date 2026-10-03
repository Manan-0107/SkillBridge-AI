/**
 * GET & POST /api/profile/anonymous
 *
 * Isolated Anonymous Profile Store:
 * - Strictly isolates each anonymous session by cryptographically random device ID
 * - Eliminates IP-based profile sharing (prevents cross-user data leakage on shared NAT/WiFi)
 * - Never stores plain-text passwords
 * - Validates input and sanitizes fields
 * - Sets secure HttpOnly cookies
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { upsertUser } from "@/lib/db";
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { createApiErrorResponse } from "@/lib/errors/apiError";

const COOKIE_NAME = "cf_anon_device";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

interface AnonymousProfile {
  name?: string;
  email?: string;
  targetRole?: string;
  skills?: string;
  completedQuestions: string[];
  updatedAt: string;
}

// In-memory cache + persistent disk backup
const globalCache = ((global as any).__cf_anon_store =
  (global as any).__cf_anon_store || new Map<string, AnonymousProfile>());

const CACHE_FILE = path.join(process.cwd(), ".anon_profiles.json");

function loadDiskBackup(): Record<string, AnonymousProfile> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch {}
  return {};
}

function saveDiskBackup(data: Record<string, AnonymousProfile>) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

// Hydrate global cache on initial load
try {
  const disk = loadDiskBackup();
  for (const [k, v] of Object.entries(disk)) {
    if (k.startsWith("dev_") && !globalCache.has(k)) {
      globalCache.set(k, v);
    }
  }
} catch {}

function generateDeviceId(): string {
  return `dev_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  let deviceId = cookieStore.get(COOKIE_NAME)?.value;
  const isNewDevice = !deviceId || !deviceId.startsWith("dev_");

  if (isNewDevice) {
    deviceId = generateDeviceId();
  }

  // Lookup ONLY by isolated device ID — NEVER by IP address
  let profile: AnonymousProfile | null = globalCache.get(deviceId!) || null;

  if (!profile) {
    const disk = loadDiskBackup();
    profile = disk[deviceId!] || null;
    if (profile) {
      globalCache.set(deviceId!, profile);
    }
  }

  const res = NextResponse.json({
    ok: true,
    profile,
    deviceId,
  });

  if (isNewDevice) {
    res.cookies.set(COOKIE_NAME, deviceId!, COOKIE_OPTS);
  }

  return res;
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const clientIp = getClientIp(req);

  // Rate limit anonymous profile updates (60/min per IP)
  const rl = checkRateLimit(`anon_profile:${clientIp}`, RATE_LIMIT_PRESETS.generalApi);
  if (rl.isLimited) {
    return createApiErrorResponse("RATE_LIMITED", "Too many profile updates.", requestId, { statusCode: 429 });
  }

  try {
    const cookieStore = cookies();
    let deviceId = cookieStore.get(COOKIE_NAME)?.value;
    if (!deviceId || !deviceId.startsWith("dev_")) {
      deviceId = generateDeviceId();
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return createApiErrorResponse("BAD_REQUEST", "Invalid JSON request payload.", requestId, { statusCode: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return createApiErrorResponse("BAD_REQUEST", "Request body must be a valid object.", requestId, { statusCode: 400 });
    }

    const existing: AnonymousProfile = globalCache.get(deviceId) || {
      completedQuestions: [],
      updatedAt: new Date().toISOString(),
    };

    // Sanitize fields (never store plain-text password)
    const sanitizedEmail =
      typeof body.email === "string" && body.email.includes("@")
        ? body.email.trim().toLowerCase().slice(0, 100)
        : existing.email;

    const sanitizedName =
      typeof body.name === "string" ? body.name.trim().slice(0, 100) : existing.name;

    const sanitizedRole =
      typeof body.targetRole === "string" ? body.targetRole.trim().slice(0, 50) : existing.targetRole;

    const sanitizedSkills =
      typeof body.skills === "string" ? body.skills.trim().slice(0, 500) : existing.skills;

    const updatedQuestions = Array.from(
      new Set([
        ...(existing.completedQuestions || []),
        ...(Array.isArray(body.completedQuestions)
          ? body.completedQuestions.filter((q: any) => typeof q === "string").slice(0, 100)
          : []),
      ])
    );

    const updatedProfile: AnonymousProfile = {
      name: sanitizedName,
      email: sanitizedEmail,
      targetRole: sanitizedRole,
      skills: sanitizedSkills,
      completedQuestions: updatedQuestions,
      updatedAt: new Date().toISOString(),
    };

    // Store ONLY by deviceId
    globalCache.set(deviceId, updatedProfile);

    // Persist to disk backup
    const disk = loadDiskBackup();
    disk[deviceId] = updatedProfile;
    // Clean any legacy IP keys from disk backup
    for (const key of Object.keys(disk)) {
      if (!key.startsWith("dev_")) {
        delete disk[key];
      }
    }
    saveDiskBackup(disk);

    // If an email address is provided, also sync to database users table
    if (updatedProfile.email && updatedProfile.email.includes("@")) {
      try {
        await upsertUser({
          email: updatedProfile.email,
          name: updatedProfile.name,
          targetRole: updatedProfile.targetRole,
          authProvider: "email",
        });
      } catch (dbErr) {
        console.warn("[Anonymous Profile] DB upsert note:", dbErr);
      }
    }

    const res = NextResponse.json({
      ok: true,
      profile: updatedProfile,
      deviceId,
    });

    res.cookies.set(COOKIE_NAME, deviceId, COOKIE_OPTS);
    return res;
  } catch (err: any) {
    return createApiErrorResponse("INTERNAL_ERROR", "Failed to save anonymous profile.", requestId, { statusCode: 500 });
  }
}
