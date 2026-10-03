"""
python_ai/ssrf.py
Enterprise SSRF (Server-Side Request Forgery) Defense Engine for Python AI services.

Guaranteed Invariants:
1. Strict URL parsing (http/https only, no embedded credentials).
2. Hostname normalization and blocklist (localhost, *.local, *.internal, cloud metadata).
3. IP address evaluation (decimal, hex, octal, IPv4, IPv6, IPv4-mapped IPv6, link-local, loopback, private RFC 1918, CGNAT).
4. DNS pre-resolution and verification: resolves all hostnames and inspects all A/AAAA records.
5. Manual redirect validation: blocks 301/302 redirects targeting private/internal networks.
6. Enforced timeouts and response payload bounds (chunk-level stream inspection).
"""

import ipaddress
import re
import socket
import urllib.parse
from typing import Optional, Tuple, Set
import requests


BLOCKED_HOSTNAMES: Set[str] = {
    "localhost",
    "metadata.google.internal",
    "instance-data",
}

# 100.64.0.0/10 Carrier-Grade NAT (RFC 6598)
CARRIER_GRADE_NAT = ipaddress.ip_network("100.64.0.0/10")
# 198.18.0.0/15 Benchmark testing (RFC 2544)
BENCHMARK_NET = ipaddress.ip_network("198.18.0.0/15")
# Cloud metadata endpoint
CLOUD_METADATA_IP = ipaddress.ip_address("169.254.169.254")


class SsrfSecurityException(Exception):
    """Raised when an outbound URL violates SSRF security boundaries."""
    pass


def is_ip_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """
    Checks if an IP address falls within private, loopback, link-local,
    cloud metadata, or reserved ranges.
    """
    # Check IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        return is_ip_blocked(ip.ipv4_mapped)

    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return True

    # Check Cloud metadata
    if ip == CLOUD_METADATA_IP:
        return True

    # Carrier-Grade NAT check
    if isinstance(ip, ipaddress.IPv4Address):
        if ip in CARRIER_GRADE_NAT or ip in BENCHMARK_NET:
            return True

    return False


def parse_numeric_ip(host: str) -> Optional[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    """
    Attempts to parse numeric, hex, octal, or integer-encoded IP addresses.
    Returns ipaddress object if parsed, or None.
    """
    clean = host.strip("[]")

    # 1. Decimal integer IP (e.g. 2130706433 -> 127.0.0.1)
    if clean.isdigit():
        try:
            val = int(clean)
            if 0 <= val <= 0xFFFFFFFF:
                return ipaddress.IPv4Address(val)
        except Exception:
            pass

    # 2. Octal or Hex IPv4 notation (e.g. 0x7f000001 or 0177.0.0.1)
    if re.match(r"^[0-9a-fxX.]+$", clean) and "." in clean:
        parts = clean.split(".")
        if len(parts) == 4:
            try:
                dec_parts = []
                for p in parts:
                    if p.startswith(("0x", "0X")):
                        dec_parts.append(int(p, 16))
                    elif len(p) > 1 and p.startswith("0"):
                        dec_parts.append(int(p, 8))
                    else:
                        dec_parts.append(int(p, 10))
                if all(0 <= p <= 255 for p in dec_parts):
                    return ipaddress.IPv4Address(".".join(str(p) for p in dec_parts))
            except Exception:
                pass

    # 3. Standard IPv4 or IPv6
    try:
        return ipaddress.ip_address(clean)
    except ValueError:
        return None


def validate_url_for_ssrf(url: str, allow_http: bool = True) -> Tuple[bool, str]:
    """
    Validates a URL against SSRF policy:
    - Scheme must be http or https
    - No credentials in URL
    - Hostname must not be blocked or resolve to private/loopback/cloud metadata IP
    """
    if not url or not isinstance(url, str):
        return False, "URL must be a non-empty string."

    try:
        parsed = urllib.parse.urlsplit(url.strip())
    except Exception as e:
        return False, f"Malformed URL: {e}"

    if parsed.scheme.lower() not in ("http", "https"):
        return False, f"Disallowed scheme: '{parsed.scheme}'. Only HTTP and HTTPS are permitted."

    if not allow_http and parsed.scheme.lower() != "https":
        return False, "HTTPS is mandatory for this operation."

    if parsed.username or parsed.password:
        return False, "Embedded credentials (user:pass) are prohibited in URL."

    hostname = parsed.hostname
    if not hostname:
        return False, "URL must contain a valid hostname."

    hostname_lower = hostname.lower()

    # Block internal hostname aliases
    if (
        hostname_lower in BLOCKED_HOSTNAMES
        or hostname_lower.endswith(".localhost")
        or hostname_lower.endswith(".local")
        or hostname_lower.endswith(".internal")
        or hostname_lower.endswith(".lan")
    ):
        return False, f"Hostname '{hostname_lower}' resolves to a restricted local or internal network."

    # Check port
    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    if port not in (80, 443, 8080, 8081, 3000):
        return False, f"Disallowed port: {port}."

    # Check direct numeric / encoded IP
    parsed_ip = parse_numeric_ip(hostname_lower)
    if parsed_ip is not None:
        if is_ip_blocked(parsed_ip):
            return False, f"IP address '{parsed_ip}' is in a private, loopback, or cloud-metadata range."
        return True, "Valid IP address."

    # DNS Resolution: resolve hostname and inspect all A/AAAA records
    try:
        addr_info = socket.getaddrinfo(hostname_lower, port, proto=socket.IPPROTO_TCP)
        if not addr_info:
            return False, f"Could not resolve hostname: {hostname_lower}"

        for entry in addr_info:
            sockaddr = entry[4]
            ip_str = sockaddr[0]
            try:
                resolved_ip = ipaddress.ip_address(ip_str)
                if is_ip_blocked(resolved_ip):
                    return False, f"Hostname '{hostname_lower}' resolved to restricted IP: {resolved_ip}"
            except ValueError:
                return False, f"Resolved invalid IP: {ip_str}"

    except socket.gaierror as e:
        return False, f"DNS resolution failed for '{hostname_lower}': {e}"
    except Exception as e:
        return False, f"DNS lookup error: {e}"

    return True, "OK"


def safe_fetch_url(
    url: str,
    headers: Optional[dict] = None,
    timeout: int = 5,
    max_redirects: int = 3,
    max_bytes: int = 1048576,  # 1MB limit
) -> Tuple[int, str, str]:
    """
    Safely fetches a web page with manual redirect verification and payload bound enforcement.
    Returns: (status_code, content_text, final_url)
    Raises: SsrfSecurityException on any policy violation.
    """
    current_url = url.strip()
    redirect_count = 0
    final_resp_text = ""
    final_status = 0

    req_headers = headers or {
        "User-Agent": "CareerForge-Assistant/2.0 (SSRF-Protected; bot/educational)"
    }

    while redirect_count <= max_redirects:
        # Validate current hop
        valid, reason = validate_url_for_ssrf(current_url)
        if not valid:
            raise SsrfSecurityException(f"SSRF violation: {reason}")

        try:
            # Stream the request without automatic redirect following
            resp = requests.get(
                current_url,
                headers=req_headers,
                timeout=timeout,
                allow_redirects=False,
                stream=True,
            )
        except Exception as e:
            raise SsrfSecurityException(f"Network fetch failed for '{current_url}': {e}")

        final_status = resp.status_code

        # If redirect, validate new Location header
        if resp.status_code in (301, 302, 303, 307, 308):
            location = resp.headers.get("Location")
            if not location:
                raise SsrfSecurityException("Redirect response missing Location header.")
            # Resolve relative redirect
            next_url = urllib.parse.urljoin(current_url, location)
            current_url = next_url
            redirect_count += 1
            continue

        # Non-redirect: Read content bounded by max_bytes
        downloaded = bytearray()
        try:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    downloaded.extend(chunk)
                    if len(downloaded) > max_bytes:
                        raise SsrfSecurityException(
                            f"Response size exceeded safety boundary ({max_bytes} bytes)."
                        )
        except SsrfSecurityException:
            raise
        except Exception as e:
            raise SsrfSecurityException(f"Error reading response body: {e}")
        finally:
            resp.close()

        encoding = resp.encoding or "utf-8"
        try:
            final_resp_text = downloaded.decode(encoding, errors="replace")
        except Exception:
            final_resp_text = downloaded.decode("utf-8", errors="replace")

        return final_status, final_resp_text, current_url

    raise SsrfSecurityException(f"Exceeded maximum allowed redirects ({max_redirects}).")
