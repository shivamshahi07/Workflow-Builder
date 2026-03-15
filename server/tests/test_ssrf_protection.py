"""Tests for SSRF protection in validate_url_for_ssrf."""

import pytest
import sys
import os

# Allow importing app modules without a running database
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.security import validate_url_for_ssrf


# ---------------------------------------------------------------------------
# URLs that MUST be blocked
# ---------------------------------------------------------------------------

BLOCKED_URLS = [
    # Cloud metadata endpoints
    ("http://169.254.169.254/latest/meta-data/", "AWS/GCP/Azure metadata endpoint"),
    ("http://169.254.169.254/", "link-local root"),
    # Loopback
    ("http://127.0.0.1/", "IPv4 loopback"),
    ("http://127.0.0.1:8080/admin", "loopback with port"),
    ("http://localhost/", "localhost hostname"),
    ("http://0.0.0.0/", "0.0.0.0"),
    # RFC 1918 private ranges
    ("http://10.0.0.1/", "10.x private"),
    ("http://10.255.255.255/path", "10.x private boundary"),
    ("http://172.16.0.1/", "172.16 private"),
    ("http://172.31.255.255/", "172.31 private boundary"),
    ("http://192.168.1.1/", "192.168 private"),
    ("http://192.168.0.0/", "192.168.0.0"),
    # CGNAT / shared address space
    ("http://100.64.0.1/", "CGNAT range"),
    # Disallowed schemes
    ("file:///etc/passwd", "file scheme"),
    ("ftp://example.com/", "ftp scheme"),
    ("gopher://example.com/", "gopher scheme"),
    ("dict://example.com/", "dict scheme"),
    ("sftp://example.com/", "sftp scheme"),
]

@pytest.mark.parametrize("url,description", BLOCKED_URLS)
def test_blocked_url(url, description):
    """Ensure requests to internal/private/dangerous URLs are rejected."""
    with pytest.raises(ValueError, match=r"(not allowed|not permitted|scheme|resolve|hostname)"):
        validate_url_for_ssrf(url)


# ---------------------------------------------------------------------------
# URLs that MUST be allowed
# ---------------------------------------------------------------------------

ALLOWED_URLS = [
    "https://httpbin.org/get",
    "http://httpbin.org/post",
    "https://api.github.com/",
    "https://example.com/path?q=1",
]

@pytest.mark.parametrize("url", ALLOWED_URLS)
def test_allowed_url(url):
    """Ensure legitimate public URLs pass validation without raising."""
    # Should not raise
    validate_url_for_ssrf(url)


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_empty_url_raises():
    with pytest.raises(ValueError):
        validate_url_for_ssrf("")


def test_no_scheme_raises():
    with pytest.raises(ValueError):
        validate_url_for_ssrf("example.com/path")


def test_missing_hostname_raises():
    with pytest.raises(ValueError):
        validate_url_for_ssrf("http:///path")


def test_decimal_encoded_loopback():
    """http://2130706433/ == http://127.0.0.1/ — must be blocked."""
    with pytest.raises(ValueError):
        validate_url_for_ssrf("http://2130706433/")


def test_hex_encoded_loopback():
    """http://0x7f000001/ == http://127.0.0.1/ — must be blocked."""
    with pytest.raises(ValueError):
        validate_url_for_ssrf("http://0x7f000001/")
