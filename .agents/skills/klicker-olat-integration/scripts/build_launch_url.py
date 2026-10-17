"""Build course-chatbot entry URLs offline; never read credentials or send requests.

Omit both URL options for the dated UZH defaults. For any explicit deployment,
supply both its verified LTI launch base and its verified participant origin.
Syntax checks cannot establish a provider registration, resource or access right.
"""

import argparse
import ipaddress
import json
import re
import sys
from urllib.parse import quote, urlsplit
from uuid import UUID

DEFAULT_LTI_BASE = "https://lti.klicker.uzh.ch"
DEFAULT_PARTICIPANT_ORIGIN = "https://pwa.klicker.uzh.ch"


def resource_id(value):
    """Accept canonical hyphenated UUID strings, normalising letter case only."""
    if not isinstance(value, str):
        raise ValueError("Resource IDs must be canonical hyphenated UUID strings")
    try:
        parsed = UUID(value)
    except ValueError:
        raise ValueError("Expected a verified UUID, not a URL or credential") from None
    if str(parsed) != value.lower():
        raise ValueError("Use the canonical hyphenated UUID from the resource link")
    return str(parsed)


def validate_https_url(value, label, origin_only=False):
    """Validate conservatively without rewriting an exact registered launch URL.

    Use ASCII hostnames (punycode for international names) and percent-encoded
    non-ASCII path characters. Errors deliberately omit supplied values.
    """
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label} must be a non-empty HTTPS URL")
    if any(ord(char) <= 32 or ord(char) >= 127 for char in value):
        raise ValueError(f"{label} must use ASCII without whitespace or controls")
    if "\\" in value:
        raise ValueError(f"{label} must not contain backslashes")
    if re.search(r"%(?![0-9a-fA-F]{2})", value):
        raise ValueError(f"{label} contains an invalid percent escape")
    if re.search(r"%(?:[01][0-9a-f]|7f|5c)", value, re.IGNORECASE):
        raise ValueError(f"{label} must not contain encoded controls or backslashes")
    if "?" in value or "#" in value:
        raise ValueError(f"{label} must not include a query or fragment")

    try:
        parts = urlsplit(value)
        host = parts.hostname
        port = parts.port  # Accessing this property checks syntax and range.
    except ValueError:
        raise ValueError(f"{label} has an invalid host or port") from None
    if parts.scheme != "https" or not parts.netloc or not host:
        raise ValueError(f"{label} must be an absolute HTTPS URL with a host")
    if "@" in parts.netloc:
        raise ValueError(f"{label} must not include user information or credentials")
    if "%" in parts.netloc:
        raise ValueError(f"{label} must not contain escapes in its authority")
    if parts.netloc.endswith(":") or port == 0:
        raise ValueError(f"{label} port must be a number from 1 to 65535")

    if ":" in host:
        try:
            ipaddress.IPv6Address(host)
        except ValueError:
            raise ValueError(f"{label} has an invalid IPv6 host") from None
        if not re.fullmatch(r"\[[0-9a-fA-F:.]+\](?::[0-9]+)?", parts.netloc):
            raise ValueError(f"{label} has an invalid IPv6 authority")
    else:
        # Numeric-looking hosts are parsed differently by browsers; require the
        # standard IPv4 spelling instead of accepting short, octal or hex forms.
        dns_host = host[:-1] if host.endswith(".") else host
        last_label = dns_host.rsplit(".", 1)[-1]
        if last_label.isdigit() or re.fullmatch(r"0x[0-9a-f]*", last_label):
            try:
                if str(ipaddress.IPv4Address(host)) != host:
                    raise ValueError("Non-canonical IPv4 address")
            except ValueError:
                raise ValueError(f"{label} requires a standard IPv4 address") from None
        elif len(dns_host) > 253 or not all(
            re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", part)
            for part in dns_host.split(".")
        ):
            raise ValueError(f"{label} has an invalid DNS hostname")
        for dns_label in dns_host.split("."):
            if dns_label.startswith("xn--"):
                # The stdlib IDNA codec is deliberately conservative. Reject
                # unsupported spellings rather than rewriting the supplied URL.
                try:
                    decoded = dns_label.encode("ascii").decode("idna")
                    if decoded.encode("idna").decode("ascii") != dns_label:
                        raise UnicodeError("IDNA round trip failed")
                except UnicodeError:
                    raise ValueError(
                        f"{label} has an invalid or unsupported IDNA hostname"
                    ) from None
        if parts.netloc != host and parts.netloc.lower() != host:
            # A port is the only permitted suffix for a non-bracketed host.
            if not re.fullmatch(re.escape(host) + r":[0-9]+", parts.netloc.lower()):
                raise ValueError(f"{label} has an invalid authority")

    if not re.fullmatch(r"[A-Za-z0-9._~!$&'()*+,;=:@%/\-]*", parts.path):
        raise ValueError(f"{label} contains an invalid path character")
    if any(
        re.sub(r"%2e", ".", segment, flags=re.IGNORECASE) in (".", "..")
        for segment in parts.path.split("/")
    ):
        raise ValueError(f"{label} must not contain path dot segments")
    if origin_only and parts.path:
        raise ValueError(f"{label} must be an origin without a path or trailing slash")
    return value


def build_urls(course_id, bot_id, locale="en", lti_base=None, participant_origin=None):
    """Return URLs using both UZH defaults or an explicitly supplied pair.

    The caller must independently verify the deployment's LTI registration and
    participant origin. Supplying just one option is rejected to avoid mixing a
    custom deployment with a silent UZH default. No URL is opened by this helper.
    """
    course = resource_id(course_id)
    bot = resource_id(bot_id)
    if locale not in ("en", "de"):
        raise ValueError("Locale must be en or de")
    if (lti_base is None) != (participant_origin is None):
        raise ValueError("Supply both --lti-base and --participant-origin, or neither")
    if lti_base is None:
        lti_base = DEFAULT_LTI_BASE
        participant_origin = DEFAULT_PARTICIPANT_ORIGIN
    validate_https_url(lti_base, "LTI base")
    validate_https_url(participant_origin, "Participant origin", origin_only=True)

    destination = f"{participant_origin}/{locale}/course/{course}/chatbot/{bot}"
    embedded = destination + "?embed=true"
    launch = lti_base + "?redirectTo=" + quote(embedded, safe="")
    return {
        "lti_base": lti_base,
        "participant_origin": participant_origin,
        "lti_launch_url": launch,
        "embedded_destination": embedded,
        "new_window_url": destination,
        "verification": "Constructed offline; not a live access or publication test.",
        "registration_note": (
            "Defaults reflect the UZH setup tested 2026-10-13. Verify both origins "
            "and the current LTI registration. Explicit LTI bases are preserved exactly."
        ),
    }


class SafeArgumentParser(argparse.ArgumentParser):
    """Avoid echoing unknown arguments or accidentally supplied credentials."""

    def error(self, message):
        self.print_usage(sys.stderr)
        self.exit(2, "error: Unknown, missing or malformed arguments; use --help.\n")


def main():
    parser = SafeArgumentParser(description=__doc__)
    parser.add_argument("--course-id", required=True, help="Verified course UUID")
    parser.add_argument("--bot-id", required=True, help="Verified chatbot UUID")
    parser.add_argument("--locale", default="en", help="Participant language: en or de")
    parser.add_argument("--lti-base", help="Exact verified HTTPS LTI launch base")
    parser.add_argument(
        "--participant-origin",
        help="Verified HTTPS participant origin, without a trailing slash or path",
    )
    args = parser.parse_args()
    try:
        result = build_urls(
            args.course_id, args.bot_id, args.locale, args.lti_base, args.participant_origin
        )
    except ValueError as exc:
        parser.exit(2, f"error: {exc}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
