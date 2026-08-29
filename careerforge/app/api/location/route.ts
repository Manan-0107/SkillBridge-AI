/**
 * GET /api/location
 *
 * Real-Time Location API with Google Maps Geocoding / Places Integration:
 * - Strictly extracts CITY or DISTRICT (Filters out Taluka, Gram Panchayat, Tehsil, Village, Wards)
 * - Google Maps Geocoding API (`locality` & `administrative_area_level_2`)
 * - Google Places Autocomplete API for Cities
 * - High-Accuracy Reverse Geocoding with IP Fallback
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface LocationProfile {
  city: string;
  district?: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  formatted: string;
  timezone: string;
  ip?: string;
  source: "Google-Maps" | "IP-Geolocation" | "GPS-ReverseGeocode" | "Search" | "Default";
}

// ─── Filter Out Talukas, Gram Panchayats, Tehsils, Villages ──────────────────
function sanitizeCityName(raw = "", fallbackDistrict = ""): string {
  if (!raw) return fallbackDistrict || "City";
  let clean = raw.trim();

  // Strip taluka, tehsil, gram panchayat, block, mandal, ward, village suffixes
  clean = clean.replace(/\b(taluka|taluk|tehsil|tahsil|gram panchayat|panchayat|mandal|ward|village|sub-district|subdistrict|district|dist)\b/gi, "").trim();
  clean = clean.replace(/\s{2,}/g, " ").trim();

  if (!clean || clean.length < 2) {
    return fallbackDistrict || "City";
  }

  // Capitalize properly
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const search = searchParams.get("search");

    const googleKey =
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      "";

    // ─── 1. Google Maps Geocoding / Reverse Geocode from GPS Coordinates ──────
    if (lat && lon) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      if (!isNaN(latitude) && !isNaN(longitude)) {
        // Option A: Google Maps Geocoding API (Strict City/District)
        if (googleKey) {
          try {
            const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&result_type=locality|administrative_area_level_2|administrative_area_level_1&key=${googleKey}`;
            const gRes = await fetch(googleUrl, { signal: AbortSignal.timeout(4000) });
            if (gRes.ok) {
              const gData = await gRes.json();
              if (gData.status === "OK" && gData.results && gData.results.length > 0) {
                const components = gData.results[0].address_components || [];
                let city = "";
                let district = "";
                let region = "";
                let country = "";
                let countryCode = "";

                for (const c of components) {
                  const types: string[] = c.types || [];
                  if (types.includes("locality")) city = c.long_name;
                  if (types.includes("administrative_area_level_2")) district = c.long_name;
                  if (types.includes("administrative_area_level_1")) region = c.long_name;
                  if (types.includes("country")) {
                    country = c.long_name;
                    countryCode = c.short_name;
                  }
                }

                const primaryCity = sanitizeCityName(city || district, district);
                const formatted = [primaryCity, region, country].filter(Boolean).join(", ");

                return NextResponse.json({
                  status: "success",
                  location: {
                    city: primaryCity,
                    district: district || primaryCity,
                    region,
                    country,
                    countryCode: countryCode.toUpperCase(),
                    latitude,
                    longitude,
                    formatted,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                    source: "Google-Maps",
                  },
                });
              }
            }
          } catch (gErr) {
            console.warn("[Location API] Google Maps error:", gErr);
          }
        }

        // Option B: OpenStreetMap with Strict City/District Filtering
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            {
              headers: {
                "User-Agent": "CareerForge-GoogleLocationFilter/1.0",
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(4000),
            }
          );

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            
            // Strictly extract City or District (Filter out Katargam Taluka / Gram Panchayat)
            const rawDistrict = addr.state_district || addr.county || addr.district || "";
            const rawCity = addr.city || addr.town || rawDistrict || addr.municipality || "City";
            
            const city = sanitizeCityName(rawCity, rawDistrict);
            const district = sanitizeCityName(rawDistrict, city);
            const region = addr.state || addr.region || "";
            const country = addr.country || "Worldwide";
            const countryCode = (addr.country_code || "").toUpperCase();

            const locationProfile: LocationProfile = {
              city,
              district,
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

    // ─── 2. City Search / Autocomplete (Strict City & District Only) ───────────
    if (search && search.trim().length > 1) {
      // Option A: Google Places Autocomplete API
      if (googleKey) {
        try {
          const gPlacesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(search.trim())}&types=(cities)&key=${googleKey}`;
          const pRes = await fetch(gPlacesUrl, { signal: AbortSignal.timeout(4000) });
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData.status === "OK" && pData.predictions) {
              const suggestions = pData.predictions.map((p: any) => {
                const mainText = p.structured_formatting?.main_text || p.description.split(",")[0];
                const secondaryText = p.structured_formatting?.secondary_text || "";
                return {
                  city: sanitizeCityName(mainText),
                  region: secondaryText.split(",")[0]?.trim() || "",
                  country: secondaryText.split(",").pop()?.trim() || "",
                  countryCode: "LOC",
                  formatted: p.description,
                };
              });

              return NextResponse.json({
                status: "success",
                suggestions,
              });
            }
          }
        } catch (pErr) {
          console.warn("[Location API] Google Places error:", pErr);
        }
      }

      // Option B: Public City Search with Clean City/District Format
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search.trim())}&format=json&limit=5&addressdetails=1&featuretype=city`,
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
              state_district?: string;
              county?: string;
              state?: string;
              country?: string;
              country_code?: string;
            };
          }> = await res.json();

          const suggestions = items.map((item) => {
            const rawDistrict = item.address?.state_district || item.address?.county || "";
            const rawCity = item.address?.city || item.address?.town || rawDistrict || item.display_name.split(",")[0];
            const city = sanitizeCityName(rawCity, rawDistrict);
            const region = item.address?.state || "";
            const country = item.address?.country || "";

            return {
              city,
              district: rawDistrict ? sanitizeCityName(rawDistrict) : city,
              region,
              country,
              countryCode: (item.address?.country_code || "").toUpperCase(),
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
              formatted: [city, region, country].filter(Boolean).join(", "),
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

    // ─── 3. Auto-detect from Client IP (Clean City & District) ─────────────────
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

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
          const cleanCity = sanitizeCityName(data.city);
          const locationProfile: LocationProfile = {
            city: cleanCity,
            district: cleanCity,
            region: data.region || "",
            country: data.country || "India",
            countryCode: data.country_code || "IN",
            latitude: data.latitude || 21.198,
            longitude: data.longitude || 72.829,
            formatted: `${cleanCity}, ${data.region ? data.region + ", " : ""}${data.country}`,
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
      // fallback
    }

    // Default Clean Tech Hub fallback
    const defaultProfile: LocationProfile = {
      city: "Surat",
      district: "Surat",
      region: "Gujarat",
      country: "India",
      countryCode: "IN",
      latitude: 21.198,
      longitude: 72.829,
      formatted: "Surat, Gujarat, India",
      timezone: "Asia/Kolkata",
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
          city: "Worldwide Remote",
          district: "",
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
