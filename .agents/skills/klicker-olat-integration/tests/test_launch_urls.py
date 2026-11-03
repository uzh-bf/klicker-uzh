"""Offline regression tests; synthetic resource IDs and no network/service access.

Run from the repository root:
python -B -m unittest discover -s .agents/skills/klicker-olat-integration/tests -v
"""

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
from urllib.parse import parse_qs, urlsplit

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_launch_url.py"
SPEC = importlib.util.spec_from_file_location("build_launch_url", SCRIPT)
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)
COURSE = "11111111-1111-4111-8111-111111111111"
BOT = "22222222-2222-4222-8222-222222222222"
LTI = "https://lti.example.edu"
PARTICIPANT = "https://pwa.example.edu"


class LaunchUrlTests(unittest.TestCase):
    def custom(self, lti=LTI, participant=PARTICIPANT, locale="en"):
        return builder.build_urls(COURSE, BOT, locale, lti, participant)

    def cli(self, *args):
        return subprocess.run(
            [sys.executable, "-B", str(SCRIPT), *args],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_default_pair_and_exact_origin(self):
        result = builder.build_urls(COURSE, BOT)
        self.assertEqual(result["lti_base"], builder.DEFAULT_LTI_BASE)
        self.assertEqual(result["participant_origin"], builder.DEFAULT_PARTICIPANT_ORIGIN)
        self.assertTrue(
            result["lti_launch_url"].startswith(builder.DEFAULT_LTI_BASE + "?redirectTo=")
        )
        self.assertEqual(urlsplit(result["lti_launch_url"]).path, "")

    def test_encoded_once_and_only_redirect_parameter(self):
        result = self.custom()
        query = parse_qs(urlsplit(result["lti_launch_url"]).query)
        self.assertEqual(query, {"redirectTo": [result["embedded_destination"]]})
        destination = urlsplit(query["redirectTo"][0])
        self.assertEqual(parse_qs(destination.query), {"embed": ["true"]})
        self.assertEqual(destination.hostname, "pwa.example.edu")
        self.assertEqual(destination.path, f"/en/course/{COURSE}/chatbot/{BOT}")
        self.assertEqual(result["new_window_url"], PARTICIPANT + destination.path)
        self.assertNotIn("?", result["new_window_url"])

    def test_german_destination(self):
        self.assertIn("/de/course/", self.custom(locale="de")["embedded_destination"])

    def test_explicit_pair_required(self):
        for options in (
            {"lti_base": LTI},
            {"participant_origin": PARTICIPANT},
            {"lti_base": builder.DEFAULT_LTI_BASE},
        ):
            with self.subTest(options=options), self.assertRaisesRegex(ValueError, "both"):
                builder.build_urls(COURSE, BOT, **options)

    def test_lti_registration_path_preserved(self):
        for base in (LTI + "/", LTI + "/registered/", LTI + "/launch%20page"):
            with self.subTest(base=base):
                result = self.custom(lti=base)
                self.assertEqual(result["lti_base"], base)
                self.assertTrue(result["lti_launch_url"].startswith(base + "?redirectTo="))

    def test_explicit_participant_origin_and_ports(self):
        result = self.custom(LTI + ":8443/registered", PARTICIPANT + ":9443")
        self.assertTrue(result["embedded_destination"].startswith(PARTICIPANT + ":9443/"))
        self.assertEqual(urlsplit(result["lti_launch_url"]).port, 8443)

    def test_ipv6_and_standard_ipv4(self):
        for origin in ("https://[2001:db8::1]:8443", "https://192.0.2.1"):
            with self.subTest(origin=origin):
                self.assertEqual(self.custom(origin, origin)["participant_origin"], origin)

    def test_canonical_uuid_case(self):
        value = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"
        result = builder.build_urls(value, BOT)
        self.assertIn(value.lower(), result["embedded_destination"])

    def test_invalid_resource_ids(self):
        for value in (
            "", None, 1, "not-a-uuid", "https://example.edu/", COURSE.replace("-", ""),
            "{" + COURSE + "}", "urn:uuid:" + COURSE, COURSE + "?token=synthetic",
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                builder.build_urls(value, BOT)
            with self.subTest(bot=value), self.assertRaises(ValueError):
                builder.build_urls(COURSE, value)

    def test_reject_schemes_query_fragment_and_credentials(self):
        for base in (
            "http://example.edu", "//example.edu", "https://", "https:example.edu",
            "https://user:synthetic@example.edu", "https://@example.edu",
            "https://example.edu?x=1", "https://example.edu#fragment",
            "https://example.edu?", "https://example.edu#",
        ):
            with self.subTest(base=base), self.assertRaises(ValueError):
                self.custom(lti=base)

    def test_reject_malformed_authorities(self):
        for base in (
            "https://example.edu:bogus", "https://example.edu:99999",
            "https://example.edu:0", "https://example.edu:", "https://exa%mple.edu",
            "https://%65xample.edu", "https://example..edu", "https://example.edu..",
            "https://-example.edu", "https://example_.edu", "https://[2001:db8::1]junk",
            "https://[invalid]", "https://999.999.999.999", "https://127.1",
            "https://0x7f000001", "https://0177.0.0.1", "https://0x",
            "https://0X", "https://0x.0x.0x.0x", "https://foo.0x",
        ):
            with self.subTest(base=base), self.assertRaises(ValueError):
                self.custom(lti=base)

    def test_reject_controls_whitespace_and_backslashes(self):
        for base in (
            " https://example.edu", "https://example.edu/ bad",
            "https://example.edu\\other", "https://example.edu/\x00path",
            "\x00https://example.edu", "https://example.edu/\x7fpath",
            "https://example.edu/\tpath", "https://example.edu/\npath",
            "https://example.edu/%0d%0aX", "https://example.edu/%00",
            "https://example.edu/%5c", "https://example.edu/%7f",
            "https://example.edu/\u00a0", "https://ex\u00e4mple.edu",
        ):
            with self.subTest(base=base), self.assertRaises(ValueError):
                self.custom(lti=base)

    def test_idna_labels_validate_without_rewriting(self):
        origin = "https://xn--bcher-kva.example"
        self.assertEqual(self.custom(origin, origin)["participant_origin"], origin)
        for origin in ("https://xn--a.example", "https://xn--0.example"):
            with self.subTest(origin=origin), self.assertRaisesRegex(ValueError, "IDNA"):
                self.custom(lti=origin)
            with self.subTest(participant=origin), self.assertRaisesRegex(ValueError, "IDNA"):
                self.custom(participant=origin)

    def test_reject_invalid_paths_and_dot_segments(self):
        for path in ("/%", "/%zz", "/<tag>", "/a/../b", "/./", "/%2e%2e/", "/.%2E/"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.custom(lti=LTI + path)

    def test_participant_origin_cannot_contain_path_or_query(self):
        for suffix in ("/", "/course", "?", "?embed=true", "#fragment"):
            with self.subTest(suffix=suffix), self.assertRaises(ValueError):
                self.custom(participant=PARTICIPANT + suffix)

    def test_participant_origin_gets_same_host_validation(self):
        for origin in ("https://@example.edu", "https://example.edu:bad", "https://exa%mple.edu"):
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                self.custom(participant=origin)

    def test_invalid_locale(self):
        with self.assertRaisesRegex(ValueError, "Locale"):
            self.custom(locale="fr")

    def test_cli_success_json_and_verification_boundary(self):
        result = self.cli(
            "--course-id", COURSE, "--bot-id", BOT, "--lti-base", LTI,
            "--participant-origin", PARTICIPANT,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload, self.custom())
        self.assertIn("not a live", payload["verification"])

    def test_cli_errors_never_echo_supplied_values(self):
        sentinel = "SYNTHETIC_VALUE_MUST_NOT_BE_ECHOED"
        for extra in (
            ["--lti-base", f"https://user:{sentinel}@example.edu", "--participant-origin", PARTICIPANT],
            ["--lti-base", f"https://[{sentinel}]", "--participant-origin", PARTICIPANT],
            ["--locale", sentinel], ["--unknown", sentinel], [sentinel],
            ["--course-id", sentinel],
        ):
            with self.subTest(extra=extra):
                result = self.cli("--course-id", COURSE, "--bot-id", BOT, *extra)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(result.stdout, "")
                self.assertNotIn(sentinel, result.stderr)
                self.assertIn("error:", result.stderr)


if __name__ == "__main__":
    unittest.main()
