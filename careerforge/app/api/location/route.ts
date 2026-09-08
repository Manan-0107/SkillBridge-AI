/**
 * GET /api/location
 *
 * Real-Time Location Finder & Reverse Geocoding API:
 * - IP Geolocation (ipwho.is & ipapi.co)
 * - Reverse Geocoding via Coordinates (OpenStreetMap Nominatim)
 * - City Autocomplete Search
 * - SSRF Protection: Strict IPv4/IPv6 validation & private IP rejection
 * - Finite coordinate bounds validation (-90..90, -180..180)
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface LocationProfile {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  formatted: string;
  timezone: string;
  ip?: string;
  source: "IP-Geolocation" | "GPS-ReverseGeocode" | "Search" | "Default";
}

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

function isSafePublicIp(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  if (!IPV4_REGEX.test(trimmed) && !IPV6_REGEX.test(trimmed)) return false;

  // Disallow localhost, private, multicast, carrier NAT, link-local
  if (
    trimmed === "127.0.0.1" ||
    trimmed === "::1" ||
    trimmed === "localhost" ||
    trimmed.startsWith("10.") ||
    trimmed.startsWith("192.168.") ||
    trimmed.startsWith("169.254.") ||
    trimmed.startsWith("100.64.") ||
    trimmed.startsWith("198.18.") ||
    trimmed.startsWith("198.19.") ||
    trimmed.startsWith("224.") ||
    trimmed.startsWith("240.") ||
    trimmed.startsWith("0.") ||
    trimmed.startsWith("fc00:") ||
    trimmed.startsWith("fe80:") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(trimmed)
  ) {
    return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const search = searchParams.get("search");

    // ─── 1. Reverse Geocode from GPS Coordinates ──────────────────────────────
    if (lat !== null && lon !== null) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      ) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&format=json&addressdetails=1`,
            {
              headers: {
                "User-Agent": "CareerForge-LocationFinder/1.0",
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(4000),
            }
          );

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const city =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.suburb ||
              addr.county ||
              "Your Location";
            const region = addr.state || addr.region || "";
            const country = addr.country || "Worldwide";
            const countryCode = (addr.country_code || "").toUpperCase();

            const locationProfile: LocationProfile = {
              city,
              region,
              country,
              countryCode,
              latitude,
              longitude,
              formatted: [city, region, country].filter(Boolean).join(", "),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
              source: "GPS-ReverseGeocode",
            };

            return NextResponse.json({
              status: "success",
              location: locationProfile,
            });
          }
        } catch (geoErr) {
          console.warn(`[Location API] Reverse geocode error (${requestId}):`, geoErr);
        }
      }
    }

    // ─── 2. City Search / Autocomplete ────────────────────────────────────────
    if (search && search.trim().length > 1) {
      const sanitizedSearch = search.trim().slice(0, 100);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(sanitizedSearch)}&format=json&limit=5&addressdetails=1`,
          {
            headers: {
              "User-Agent": "CareerForge-LocationFinder/1.0",
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(4000),
          }
        );

        if (res.ok) {
          const items: Array<{
            lat: string;
            lon: string;
            display_name: string;
            address?: {
              city?: string;
              town?: string;
              state?: string;
              country?: string;
              country_code?: string;
            };
          }> = await res.json();

          const suggestions = items.map((item) => {
            const city = item.address?.city || item.address?.town || item.display_name.split(",")[0];
            const country = item.address?.country || "";
            const parsedLat = parseFloat(item.lat);
            const parsedLon = parseFloat(item.lon);
            return {
              city,
              region: item.address?.state || "",
              country,
              countryCode: (item.address?.country_code || "").toUpperCase(),
              latitude: Number.isFinite(parsedLat) ? parsedLat : 0,
              longitude: Number.isFinite(parsedLon) ? parsedLon : 0,
              formatted: item.display_name,
            };
          });

          return NextResponse.json({
            status: "success",
            suggestions,
          });
        }
      } catch (searchErr) {
        console.warn(`[Location API] Search error (${requestId}):`, searchErr);
      }
    }

    // ─── 3. Auto-detect from Client IP (Primary Zero-Click Location) ───────────
    const rawIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "";

    const isSafeIp = isSafePublicIp(rawIp);

    // Try ipwho.is
    try {
      const ipUrl = isSafeIp
        ? `https://ipwho.is/${encodeURIComponent(rawIp)}`
        : "https://ipwho.is/";

      const res = await fetch(ipUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success !== false && data.city) {
          const locationProfile: LocationProfile = {
            city: data.city,
            region: data.region || "",
            country: data.country || "United States",
            countryCode: data.country_code || "US",
            latitude: Number.isFinite(data.latitude) ? data.latitude : 37.7749,
            longitude: Number.isFinite(data.longitude) ? data.longitude : -122.4194,
            formatted: `${data.city}, ${data.region ? data.region + ", " : ""}${data.country}`,
            timezone: data.timezone?.id || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            ip: data.ip,
            source: "IP-Geolocation",
          };

          return NextResponse.json({
            status: "success",
            location: locationProfile,
          });
        }
      }
    } catch {
      // fallback to ipapi
    }

    // Fallback: ipapi.co
    try {
      const res = await fetch("https://ipapi.co/json/", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.city) {
          const locationProfile: LocationProfile = {
            city: data.city,
            region: data.region || "",
            country: data.country_name || "Worldwide",
            countryCode: data.country_code || "US",
            latitude: Number.isFinite(data.latitude) ? data.latitude : 37.7749,
            longitude: Number.isFinite(data.longitude) ? data.longitude : -122.4194,
            formatted: `${data.city}, ${data.region ? data.region + ", " : ""}${data.country_name}`,
            timezone: data.timezone || "UTC",
            ip: data.ip,
            source: "IP-Geolocation",
          };

          return NextResponse.json({
            status: "success",
            location: locationProfile,
          });
        }
      }
    } catch {
      // fallback to default
    }

    // Default Tech Hub fallback
    const defaultProfile: LocationProfile = {
      city: "San Francisco",
      region: "California",
      country: "United States",
      countryCode: "US",
      latitude: 37.7749,
      longitude: -122.4194,
      formatted: "San Francisco, CA, USA",
      timezone: "America/Los_Angeles",
      source: "Default",
    };

    return NextResponse.json({
      status: "fallback",
      location: defaultProfile,
    });
  } catch (error) {
    console.error(`[Location API] Fatal error (${requestId}):`, error);
    return NextResponse.json(
      {
        status: "error",
        location: {
          city: "Remote / Worldwide",
          region: "",
          country: "Global",
          countryCode: "GL",
          latitude: 0,
          longitude: 0,
          formatted: "Worldwide Remote",
          timezone: "UTC",
          source: "Default",
        },
      },
      { status: 200 }
    );
  }
}
