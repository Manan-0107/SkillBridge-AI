"""
tests/test_ssrf_python.py
SSRF regression test suite for Python AI services.

Verifies:
1. 127.0.0.1 loopback
2. localhost and *.localhost
3. 10.0.0.1 (RFC 1918 Private)
4. 172.16.0.1 (RFC 1918 Private)
5. 192.168.0.1 (RFC 1918 Private)
6. 169.254.169.254 (Cloud metadata / Link-Local)
7. IPv6 loopback (::1, [::1])
8. IPv6 link-local (fe80::1)
9. Encoded IPv4 (hex 0x7f.0.0.1, octal 0177.0.0.1)
10. Decimal IPv4 (2130706433 = 127.0.0.1)
11. Non-http schemes (file://, gopher://, ftp://, dict://)
12. Redirect to private IP (simulated redirect chain)
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from python_ai.ssrf import validate_url_for_ssrf, safe_fetch_url, SsrfSecurityException


class TestPythonSsrfValidation(unittest.TestCase):
    def test_loopback_ipv4(self):
        valid, reason = validate_url_for_ssrf("http://127.0.0.1/admin")
        self.assertFalse(valid)
        self.assertIn("private, loopback, or cloud-metadata", reason)

        valid2, reason2 = validate_url_for_ssrf("http://127.0.0.2:8080/secrets")
        self.assertFalse(valid2)

    def test_localhost(self):
        valid, reason = validate_url_for_ssrf("http://localhost:3000/api")
        self.assertFalse(valid)
        self.assertIn("restricted local or internal network", reason)

        valid2, reason2 = validate_url_for_ssrf("http://test.localhost/api")
        self.assertFalse(valid2)

        valid3, reason3 = validate_url_for_ssrf("http://service.local/")
        self.assertFalse(valid3)

        valid4, reason4 = validate_url_for_ssrf("http://metadata.google.internal/computeMetadata")
        self.assertFalse(valid4)

    def test_rfc1918_private_ranges(self):
        # 10.0.0.1
        valid_10, _ = validate_url_for_ssrf("http://10.0.0.1/conf")
        self.assertFalse(valid_10)

        # 172.16.0.1
        valid_172, _ = validate_url_for_ssrf("http://172.16.0.1/status")
        self.assertFalse(valid_172)

        valid_172_31, _ = validate_url_for_ssrf("http://172.31.255.254/status")
        self.assertFalse(valid_172_31)

        # 192.168.0.1
        valid_192, _ = validate_url_for_ssrf("http://192.168.1.1/router")
        self.assertFalse(valid_192)

    def test_cloud_metadata_link_local(self):
        valid_meta, _ = validate_url_for_ssrf("http://169.254.169.254/latest/meta-data/")
        self.assertFalse(valid_meta)

        valid_link, _ = validate_url_for_ssrf("http://169.254.1.1/")
        self.assertFalse(valid_link)

    def test_ipv6_loopback_and_link_local(self):
        # [::1]
        valid_v6_loop, _ = validate_url_for_ssrf("http://[::1]/")
        self.assertFalse(valid_v6_loop)

        # [fe80::1]
        valid_v6_ll, _ = validate_url_for_ssrf("http://[fe80::1]/")
        self.assertFalse(valid_v6_ll)

    def test_encoded_and_decimal_ipv4(self):
        # Decimal 2130706433 == 127.0.0.1
        valid_dec, _ = validate_url_for_ssrf("http://2130706433/")
        self.assertFalse(valid_dec)

        # Hex 0x7f.0.0.1 == 127.0.0.1
        valid_hex, _ = validate_url_for_ssrf("http://0x7f.0.0.1/")
        self.assertFalse(valid_hex)

        # Octal 0177.0.0.1 == 127.0.0.1
        valid_oct, _ = validate_url_for_ssrf("http://0177.0.0.1/")
        self.assertFalse(valid_oct)

    def test_non_http_schemes(self):
        schemes = [
            "file:///etc/passwd",
            "gopher://127.0.0.1:70/",
            "ftp://ftp.example.com/",
            "dict://127.0.0.1:2628/",
            "ldap://127.0.0.1:389/",
        ]
        for s in schemes:
            valid, reason = validate_url_for_ssrf(s)
            self.assertFalse(valid, f"Scheme in {s} should have been rejected")
            self.assertIn("Disallowed scheme", reason)

    def test_embedded_credentials(self):
        valid, reason = validate_url_for_ssrf("http://admin:password@example.com/")
        self.assertFalse(valid)
        self.assertIn("Embedded credentials", reason)

    def test_valid_public_url(self):
        valid, reason = validate_url_for_ssrf("https://en.wikipedia.org/wiki/React_(software)")
        self.assertTrue(valid)

    @patch("python_ai.ssrf.requests.get")
    def test_redirect_to_private_ip_blocked(self, mock_get):
        # First request returns 302 redirect to http://169.254.169.254
        mock_redirect = MagicMock()
        mock_redirect.status_code = 302
        mock_redirect.headers = {"Location": "http://169.254.169.254/latest/meta-data/"}
        mock_get.return_value = mock_redirect

        with self.assertRaises(SsrfSecurityException) as ctx:
            safe_fetch_url("https://en.wikipedia.org/redirect-test")

        self.assertIn("SSRF violation", str(ctx.exception))
        self.assertIn("private, loopback, or cloud-metadata", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
