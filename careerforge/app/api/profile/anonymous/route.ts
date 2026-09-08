import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { upsertUser } from "@/lib/db";

const COOKIE_NAME = "cf_anon_device";
const COOKIE_OPTS = {
  httpOnly: false, // accessible to client as fallback
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

interface AnonymousProfile {
  name?: string;
  email?: string;
  password?: string;
  targetRole?: string;
  skills?: string;
  completedQuestions: string[];
  updatedAt: string;
}

// In-memory cache + persistent disk backup
const globalCache = (global as any).__cf_anon_store || new Map<string, AnonymousProfile>();
(global as any).__cf_anon_store = globalCache;

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
    if (!globalCache.has(k)) {
      globalCache.set(k, v);
    }
  }
} catch {}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  let deviceId = cookieStore.get(COOKIE_NAME)?.value;
  const isNewDevice = !deviceId;

  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  const clientIp = getClientIp(req);

  // Look up by device ID first, then by IP address
  let profile: AnonymousProfile | null =
    globalCache.get(deviceId) || globalCache.get(clientIp) || null;

  if (!profile) {
    const disk = loadDiskBackup();
    profile = disk[deviceId] || disk[clientIp] || null;
    if (profile) {
      globalCache.set(deviceId, profile);
      globalCache.set(clientIp, profile);
    }
  }

  const res = NextResponse.json({
    ok: true,
    profile,
    deviceId,
    clientIp,
  });

  if (isNewDevice) {
    res.cookies.set(COOKIE_NAME, deviceId, COOKIE_OPTS);
  }

  return res;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    let deviceId = cookieStore.get(COOKIE_NAME)?.value;
    if (!deviceId) {
      deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    const clientIp = getClientIp(req);
    const body = await req.json();

    const existing: AnonymousProfile =
      globalCache.get(deviceId) || globalCache.get(clientIp) || {
        completedQuestions: [],
        updatedAt: new Date().toISOString(),
      };

    const updatedProfile: AnonymousProfile = {
      ...existing,
      ...body,
      completedQuestions: Array.from(
        new Set([...(existing.completedQuestions || []), ...(body.completedQuestions || [])])
      ),
      updatedAt: new Date().toISOString(),
    };

    // Store by both device ID and IP
    globalCache.set(deviceId, updatedProfile);
    globalCache.set(clientIp, updatedProfile);

    // Save to disk backup
    const disk = loadDiskBackup();
    disk[deviceId] = updatedProfile;
    disk[clientIp] = updatedProfile;
    saveDiskBackup(disk);

    // If an email address is provided, also sync to database users table for fetching
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
      clientIp,
    });

    res.cookies.set(COOKIE_NAME, deviceId, COOKIE_OPTS);
    return res;
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
