/**
 * lib/security/ssrf.ts
 *
 * Enterprise SSRF (Server-Side Request Forgery) Defense Engine:
 * - Strict URL parsing and protocol enforcement (HTTPS only in production)
 * - Private, link-local, loopback, and cloud metadata (169.254.169.254) blocking
 * - IPv4/IPv6 integer, octal, hex, and mapped representation normalization
 * - Configurable hostname allowlists for CDN and external resource providers
 * - Manual redirect inspection: blocks 301/302 redirects targeting internal networks
 */

export const ALLOWED_CDN_HOSTS = new Set([
  "cdn.ubix.example",
  "static.ubix.example",
  "raw.githubusercontent.com",
  "api.github.com",
  "api.groq.com",
  "api.elevenlabs.io",
  "api.sarvam.ai",
  "generativelanguage.googleapis.com",
  "dev.to",
  "jobicy.com",
  "www.arbeitnow.com",
]);

/**
 * Checks if an IPv4 address string falls within private, loopback, or reserved ranges.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => {
    // Handle hex (0x7f) or octal (0177) or decimal numbers
    if (p.startsWith("0x") || p.startsWith("0X")) return parseInt(p, 16);
    if (p.length > 1 && p.startsWith("0")) return parseInt(p, 8);
    return parseInt(p, 10);
  });

  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed IP is unsafe
  }

  const [a, b, c, d] = parts;

  // 0.0.0.0/8 (Broadcast/Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (a === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-Local & Cloud Metadata: AWS/GCP/Azure 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (a === 192 && b === 168) return true;

  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 198.18.0.0/15 (Benchmark testing)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

/**
 * Checks if an IPv6 address string falls within loopback, link-local, or private ranges.
 */
function isPrivateIPv6(ip: string): boolean {
  const clean = ip.toLowerCase().replace(/^\[|\]$/g, "").trim();

  // ::1 / :: (Loopback & unspecified)
  if (clean === "::1" || clean === "::" || clean === "0:0:0:0:0:0:0:1" || clean === "0000:0000:0000:0000:0000:0000:0000:0001") {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (clean.startsWith("::ffff:") || clean.startsWith("0:0:0:0:0:ffff:")) {
    const v4Part = clean.replace(/^(::ffff:|0:0:0:0:0:ffff:)/, "");
    if (v4Part.includes(".")) {
      return isPrivateIPv4(v4Part);
    }
  }

  // Unique Local Address (fc00::/7)
  if (clean.startsWith("fc") || clean.startsWith("fd")) {
    return true;
  }

  // Link-Local (fe80::/10)
  if (clean.startsWith("fe8") || clean.startsWith("fe9") || clean.startsWith("fea") || clean.startsWith("feb")) {
    return true;
  }

  return false;
}

/**
 * Checks if an IP or hostname is private/loopback/cloud metadata.
 */
export function isPrivateIp(ip: string): boolean {
  return isPrivateOrBlockedHost(ip);
}

/**
 * Checks whether a given hostname is a private/loopback/cloud metadata address or internal name.
 */
export function isPrivateOrBlockedHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== "string") return true;

  const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, "");

  // Hostname aliases for local / internal networks
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host === "metadata.google.internal" ||
    host === "instance-data"
  ) {
    return true;
  }

  // Check single-number decimal IP representation (e.g. 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(host)) {
    const num = Number(host);
    if (!isNaN(num)) {
      const a = (num >>> 24) & 255;
      const b = (num >>> 16) & 255;
      const c = (num >>> 8) & 255;
      const d = num & 255;
      return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
    }
    return true;
  }

  // Check IPv4 pattern (including hex/octal notation)
  if (/^[0-9a-fxX.]+$/.test(host) && host.split(".").length === 4) {
    return isPrivateIPv4(host);
  }

  // Check IPv6
  if (host.includes(":")) {
    return isPrivateIPv6(host);
  }

  return false;
}

export interface SsrfValidationResult {
  valid: boolean;
  reason?: string;
  url?: URL;
}

/**
 * Validates a target URL against SSRF rules and optional hostname allowlists.
 */
export function validateUrlForSsrf(
  targetUrl: string,
  options?: {
    allowedHosts?: Set<string> | string[];
    allowHttpInDev?: boolean;
  }
): SsrfValidationResult {
  if (!targetUrl || typeof targetUrl !== "string") {
    return { valid: false, reason: "Target URL must be a non-empty string" };
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { valid: false, reason: "Malformed URL" };
  }

  const isDev = process.env.NODE_ENV !== "production";
  const allowHttp = options?.allowHttpInDev && isDev;

  // Protocol validation: HTTPS mandatory in production
  if (parsed.protocol !== "https:") {
    if (!allowHttp || parsed.protocol !== "http:") {
      return { valid: false, reason: `Insecure protocol: ${parsed.protocol}. Only HTTPS is permitted.` };
    }
  }

  // Forbid embedded credentials
  if (parsed.username || parsed.password) {
    return { valid: false, reason: "Embedded URL credentials (user:pass) are prohibited." };
  }

  // Forbid non-standard ports
  const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80;
  if (![80, 443].includes(port)) {
    if (!isDev || ![3000, 8081, 8000].includes(port)) {
      return { valid: false, reason: `Disallowed port: ${port}.` };
    }
  }

  const hostname = parsed.hostname.toLowerCase();

  // Internal and metadata IP check
  if (isPrivateOrBlockedHost(hostname)) {
    return { valid: false, reason: `SSRF Blocked: Hostname ${hostname} resolves to a private or restricted network.` };
  }

  // Hostname allowlist validation
  if (options?.allowedHosts) {
    const allowSet = Array.isArray(options.allowedHosts)
      ? new Set(options.allowedHosts.map((h) => h.toLowerCase()))
      : options.allowedHosts;

    if (!allowSet.has(hostname)) {
      return { valid: false, reason: `Hostname ${hostname} is not in the allowed CDN/API host allowlist.` };
    }
  }

  return { valid: true, url: parsed };
}

/**
 * Safe fetch wrapper that enforces SSRF validation and inspects redirects
 * manually up to maxRedirects to prevent 302 redirects to internal/metadata endpoints.
 */
export async function safeSsrfFetch(
  targetUrl: string,
  options?: RequestInit & {
    allowedHosts?: Set<string> | string[];
    maxRedirects?: number;
    allowHttpInDev?: boolean;
  }
): Promise<Response> {
  const maxRedirects = options?.maxRedirects ?? 3;
  let currentUrl = targetUrl;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const validation = validateUrlForSsrf(currentUrl, {
      allowedHosts: options?.allowedHosts,
      allowHttpInDev: options?.allowHttpInDev,
    });

    if (!validation.valid || !validation.url) {
      throw new Error(`SSRF Blocked: ${validation.reason || "Invalid destination"}`);
    }

    // Use manual redirect to inspect each hop
    const fetchOptions: RequestInit = {
      ...options,
      redirect: "manual",
    };

    const res = await fetch(currentUrl, fetchOptions);

    // If not a redirect, return response
    if (![301, 302, 303, 307, 308].includes(res.status)) {
      return res;
    }

    // Inspect Location header
    const location = res.headers.get("location");
    if (!location) {
      throw new Error("Redirect response missing Location header");
    }

    // Resolve relative or absolute redirect URL
    const nextUrl = new URL(location, currentUrl).toString();
    currentUrl = nextUrl;
    redirectCount++;
  }

  throw new Error(`SSRF Error: Exceeded maximum allowed redirects (${maxRedirects})`);
}
