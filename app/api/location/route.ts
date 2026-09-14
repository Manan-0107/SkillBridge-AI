/**
 * GET /api/location
 *
 * 100% Free Real-Time Location Finder & Reverse Geocoding API (Zero Key Required):
 * - IP Geolocation (ipwho.is & ipapi.co)
 * - Reverse Geocoding via Coordinates (OpenStreetMap Nominatim)
 * - City Autocomplete Search
 *
 * Query Params:
 * - lat, lon: Reverse geocode GPS coordinates to city, region, country
 * - search: City search query for autocomplete
 * - (no params): Auto-detect caller's location from client IP headers
 */

import { NextRequest, NextResponse } from "next/server";

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const search = searchParams.get("search");

    // ─── 1. Reverse Geocode from GPS Coordinates ──────────────────────────────
    if (lat && lon) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      if (!isNaN(latitude) && !isNaN(longitude)) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
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
          console.warn("[Location API] Reverse geocode error:", geoErr);
        }
      }
    }

    // ─── 2. City Search / Autocomplete ────────────────────────────────────────
    if (search && search.trim().length > 1) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search.trim())}&format=json&limit=5&addressdetails=1`,
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
            return {
              city,
              region: item.address?.state || "",
              country,
              countryCode: (item.address?.country_code || "").toUpperCase(),
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
              formatted: item.display_name,
            };
          });

          return NextResponse.json({
            status: "success",
            suggestions,
          });
        }
      } catch (searchErr) {
        console.warn("[Location API] Search error:", searchErr);
      }
    }

    // ─── 3. Auto-detect from Client IP (Primary Zero-Click Location) ───────────
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

    // Try ipwho.is (100% Free, unlimited without key)
    try {
      const ipUrl = clientIp && !isLocalhostIp(clientIp)
        ? `https://ipwho.is/${clientIp}`
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
            latitude: data.latitude || 37.7749,
            longitude: data.longitude || -122.4194,
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
            latitude: data.latitude || 37.7749,
            longitude: data.longitude || -122.4194,
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
    console.error("[Location API] Fatal error:", error);
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

function isLocalhostIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.")
  );
}
