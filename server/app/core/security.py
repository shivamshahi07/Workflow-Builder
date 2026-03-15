"""URL validation utilities to prevent Server-Side Request Forgery (SSRF)."""

import ipaddress
import socket
from urllib.parse import urlparse

_ALLOWED_SCHEMES = {"http", "https"}

# All private, loopback, link-local, and reserved IP ranges per IANA.
# Blocking these prevents requests to cloud metadata endpoints (169.254.169.254),
# internal services, and loopback interfaces.
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),          # "This" network (RFC 1122)
    ipaddress.ip_network("10.0.0.0/8"),          # Private (RFC 1918)
    ipaddress.ip_network("100.64.0.0/10"),       # Shared address space / CGNAT (RFC 6598)
    ipaddress.ip_network("127.0.0.0/8"),         # Loopback (RFC 1122)
    ipaddress.ip_network("169.254.0.0/16"),      # Link-local / cloud metadata (RFC 3927)
    ipaddress.ip_network("172.16.0.0/12"),       # Private (RFC 1918)
    ipaddress.ip_network("192.0.0.0/24"),        # IETF Protocol Assignments (RFC 6890)
    ipaddress.ip_network("192.0.2.0/24"),        # Documentation TEST-NET-1 (RFC 5737)
    ipaddress.ip_network("192.168.0.0/16"),      # Private (RFC 1918)
    ipaddress.ip_network("198.18.0.0/15"),       # Benchmark testing (RFC 2544)
    ipaddress.ip_network("198.51.100.0/24"),     # Documentation TEST-NET-2 (RFC 5737)
    ipaddress.ip_network("203.0.113.0/24"),      # Documentation TEST-NET-3 (RFC 5737)
    ipaddress.ip_network("224.0.0.0/4"),         # Multicast (RFC 3171)
    ipaddress.ip_network("240.0.0.0/4"),         # Reserved (RFC 1112)
    ipaddress.ip_network("255.255.255.255/32"),  # Broadcast
    # IPv6
    ipaddress.ip_network("::1/128"),             # IPv6 loopback
    ipaddress.ip_network("::/128"),              # IPv6 unspecified
    ipaddress.ip_network("fc00::/7"),            # IPv6 unique local (RFC 4193)
    ipaddress.ip_network("fe80::/10"),           # IPv6 link-local (RFC 4291)
    ipaddress.ip_network("ff00::/8"),            # IPv6 multicast (RFC 4291)
]


def validate_url_for_ssrf(url: str) -> None:
    """Validate a URL to prevent SSRF attacks.

    Enforces:
    - Scheme must be ``http`` or ``https`` (rejects ``file://``, ``ftp://``, etc.)
    - Hostname must resolve and every resolved IP must be a public, routable
      address (rejects loopback, RFC 1918 private ranges, link-local addresses
      such as the AWS/GCP/Azure metadata endpoint 169.254.169.254, etc.)

    Raises:
        ValueError: with a descriptive message when the URL is not allowed.
    """
    try:
        parsed = urlparse(url)
    except Exception as exc:
        raise ValueError(f"Invalid URL: {url}") from exc

    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise ValueError(
            f"URL scheme '{parsed.scheme}' is not allowed; "
            "only http and https are permitted."
        )

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL must include a valid hostname.")

    try:
        addr_infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise ValueError(
            f"Could not resolve hostname '{hostname}': {exc}"
        ) from exc

    if not addr_infos:
        raise ValueError(f"Hostname '{hostname}' did not resolve to any address.")

    for addr_info in addr_infos:
        ip_str = addr_info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue

        for blocked in _BLOCKED_NETWORKS:
            if ip in blocked:
                raise ValueError(
                    f"Requests to internal or private addresses are not permitted "
                    f"('{hostname}' resolved to {ip})."
                )
