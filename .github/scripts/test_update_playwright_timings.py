import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("update-playwright-timings.py")


def create_tests_directory(root: Path, *spec_names: str) -> None:
    tests_directory = root / "tests"
    tests_directory.mkdir()
    for spec_name in spec_names:
        (tests_directory / spec_name).write_text("", encoding="utf-8")


def write_shard(
    root: Path,
    xml: str,
    shard_index: int = 1,
    shard_total: int = 1,
    directory_suffix: str = "",
) -> None:
    artifact_directory = (
        root
        / "artifacts"
        / f"playwright-results-{shard_index}-of-{shard_total}{directory_suffix}"
    )
    artifact_directory.mkdir(parents=True)
    (artifact_directory / "junit.xml").write_text(xml, encoding="utf-8")


def run_script(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), str(root / "artifacts"), str(root / "timings.json")],
        capture_output=True,
        text=True,
        check=False,
    )


def write_prior(root: Path, durations: dict[str, float]) -> bytes:
    payload = {
        "version": 1,
        "durations": [
            {"spec": f"tests/{spec_name}", "duration": duration}
            for spec_name, duration in durations.items()
        ],
    }
    serialized = json.dumps(payload, indent=2) + "\n"
    (root / "timings.json").write_text(serialized, encoding="utf-8")
    return serialized.encode("utf-8")


class UpdatePlaywrightTimingsTests(unittest.TestCase):
    def test_mixed_successful_and_skipped_cases_publish_only_measured_time(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            tests_directory = root / "tests"
            tests_directory.mkdir()
            for spec_name in ("alpha.spec.ts", "beta.spec.ts"):
                (tests_directory / spec_name).write_text("", encoding="utf-8")

            artifact_directory = root / "artifacts" / "playwright-results-1-of-1"
            artifact_directory.mkdir(parents=True)
            (artifact_directory / "junit.xml").write_text(
                """<testsuites tests="3" failures="0" errors="0" skipped="1">
  <testsuite name="alpha.spec.ts" tests="2" failures="0" errors="0" skipped="1">
    <testcase classname="alpha.spec.ts" name="measured" time="1.25" />
    <testcase classname="alpha.spec.ts" name="skipped" time="0.75"><skipped /></testcase>
  </testsuite>
  <testsuite name="beta.spec.ts" tests="1" failures="0" errors="0" skipped="0">
    <testcase classname="beta.spec.ts" name="measured" time="2.5" />
  </testsuite>
</testsuites>
""",
                encoding="utf-8",
            )
            output_path = root / "timings.json"

            result = subprocess.run(
                [sys.executable, str(SCRIPT), str(root / "artifacts"), str(output_path)],
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                json.loads(output_path.read_text(encoding="utf-8")),
                {
                    "version": 1,
                    "durations": [
                        {"spec": "tests/alpha.spec.ts", "duration": 1.25},
                        {"spec": "tests/beta.spec.ts", "duration": 2.5},
                    ],
                },
            )

    def test_skipped_only_specs_reuse_their_prior_duration(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            create_tests_directory(root, "alpha.spec.ts", "beta.spec.ts")
            write_prior(root, {"alpha.spec.ts": 9.75})
            write_shard(
                root,
                """<testsuites tests="3" failures="0" errors="0" skipped="2">
  <testsuite name="alpha.spec.ts" tests="2" failures="0" errors="0" skipped="2">
    <testcase name="one"><skipped /></testcase>
    <testcase name="two" time="0"><skipped /></testcase>
  </testsuite>
  <testsuite name="beta.spec.ts" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="measured" time="2.5" />
  </testsuite>
</testsuites>
""",
            )

            result = run_script(root)

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                json.loads((root / "timings.json").read_text(encoding="utf-8")),
                {
                    "version": 1,
                    "durations": [
                        {"spec": "tests/alpha.spec.ts", "duration": 9.75},
                        {"spec": "tests/beta.spec.ts", "duration": 2.5},
                    ],
                },
            )

    def test_fully_skipped_run_leaves_prior_output_unchanged(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            create_tests_directory(root, "alpha.spec.ts", "beta.spec.ts")
            prior_bytes = write_prior(
                root, {"alpha.spec.ts": 9.75, "beta.spec.ts": 4.25}
            )
            write_shard(
                root,
                """<testsuites tests="2" failures="0" errors="0" skipped="2">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="0" skipped="1">
    <testcase name="skipped"><skipped /></testcase>
  </testsuite>
  <testsuite name="beta.spec.ts" tests="1" failures="0" errors="0" skipped="1">
    <testcase name="skipped" time="0"><skipped /></testcase>
  </testsuite>
</testsuites>
""",
            )

            result = run_script(root)

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((root / "timings.json").read_bytes(), prior_bytes)

    def test_skipped_only_new_spec_fails_without_a_valid_prior_duration(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            create_tests_directory(root, "alpha.spec.ts", "beta.spec.ts")
            prior_bytes = b"not a timing file\n"
            (root / "timings.json").write_bytes(prior_bytes)
            write_shard(
                root,
                """<testsuites tests="2" failures="0" errors="0" skipped="1">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="0" skipped="1">
    <testcase name="skipped"><skipped /></testcase>
  </testsuite>
  <testsuite name="beta.spec.ts" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="measured" time="2.5" />
  </testsuite>
</testsuites>
""",
            )

            result = run_script(root)

            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((root / "timings.json").read_bytes(), prior_bytes)

    def test_count_declarations_must_match_testcase_outcomes(self):
        reports = {
            "suite tests": """<testsuites tests="1" failures="0" errors="0" skipped="0">
  <testsuite name="alpha.spec.ts" tests="2" failures="0" errors="0" skipped="0">
    <testcase name="measured" time="1" />
  </testsuite>
</testsuites>
""",
            "root skipped": """<testsuites tests="1" failures="0" errors="0" skipped="1">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="measured" time="1" />
  </testsuite>
</testsuites>
""",
            "suite skipped": """<testsuites tests="1" failures="0" errors="0" skipped="0">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="0" skipped="1">
    <testcase name="measured" time="1" />
  </testsuite>
</testsuites>
""",
            "root failure": """<testsuites tests="1" failures="1" errors="0" skipped="0">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="measured" time="1" />
  </testsuite>
</testsuites>
""",
            "suite error": """<testsuites tests="1" failures="0" errors="0" skipped="0">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="1" skipped="0">
    <testcase name="measured" time="1" />
  </testsuite>
</testsuites>
""",
        }
        for report_name, report in reports.items():
            with self.subTest(report_name=report_name), tempfile.TemporaryDirectory() as temporary_directory:
                root = Path(temporary_directory)
                create_tests_directory(root, "alpha.spec.ts")
                write_shard(root, report)

                result = run_script(root)

                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((root / "timings.json").exists())

    def test_invalid_input_leaves_existing_output_unchanged(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            create_tests_directory(root, "alpha.spec.ts")
            prior_bytes = write_prior(root, {"alpha.spec.ts": 9.75})
            write_shard(
                root,
                """<testsuites tests="1" failures="0" errors="0" skipped="0">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="measured" time="0" />
  </testsuite>
</testsuites>
""",
            )

            result = run_script(root)

            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((root / "timings.json").read_bytes(), prior_bytes)

    def test_successful_update_replaces_output_atomically(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            create_tests_directory(root, "alpha.spec.ts")
            write_prior(root, {"alpha.spec.ts": 9.75})
            write_shard(
                root,
                """<testsuites tests="1" failures="0" errors="0" skipped="0">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="measured" time="1.25" />
  </testsuite>
</testsuites>
""",
            )

            result = run_script(root)

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(
                json.loads((root / "timings.json").read_text(encoding="utf-8"))[
                    "durations"
                ],
                [{"spec": "tests/alpha.spec.ts", "duration": 1.25}],
            )
            self.assertEqual(list(root.glob(".timings.json.*.tmp")), [])

    def test_failures_and_errors_are_rejected_even_when_counters_lie(self):
        reports = {
            "failure": "failure",
            "error": "error",
        }
        for report_name, outcome in reports.items():
            with self.subTest(report_name=report_name), tempfile.TemporaryDirectory() as temporary_directory:
                root = Path(temporary_directory)
                create_tests_directory(root, "alpha.spec.ts")
                write_shard(
                    root,
                    f"""<testsuites tests="1" failures="0" errors="0" skipped="0">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="bad" time="1"><{outcome} /></testcase>
  </testsuite>
</testsuites>
""",
                )

                result = run_script(root)

                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((root / "timings.json").exists())

    def test_missing_duplicate_and_unknown_artifacts_are_rejected(self):
        passing_report = """<testsuites tests="1" failures="0" errors="0" skipped="0">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="measured" time="1" />
  </testsuite>
</testsuites>
"""
        cases = ("duplicate shard", "missing shard", "unknown spec", "missing spec")
        for case in cases:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as temporary_directory:
                root = Path(temporary_directory)
                create_tests_directory(
                    root, "alpha.spec.ts", *("beta.spec.ts",) if case == "missing spec" else ()
                )
                if case == "duplicate shard":
                    write_shard(root, passing_report, 1, 1, "/first")
                    write_shard(root, passing_report, 1, 1, "/second")
                elif case == "missing shard":
                    write_shard(root, passing_report, 1, 2)
                elif case == "unknown spec":
                    write_shard(root, passing_report.replace("alpha", "unknown"))
                else:
                    write_shard(root, passing_report)

                result = run_script(root)

                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((root / "timings.json").exists())

    def test_malformed_and_oversized_reports_are_rejected(self):
        cases = ("malformed", "oversized")
        for case in cases:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as temporary_directory:
                root = Path(temporary_directory)
                create_tests_directory(root, "alpha.spec.ts")
                if case == "malformed":
                    write_shard(root, "<testsuites>")
                else:
                    artifact_directory = (
                        root / "artifacts" / "playwright-results-1-of-1"
                    )
                    artifact_directory.mkdir(parents=True)
                    report_path = artifact_directory / "junit.xml"
                    with report_path.open("wb") as report_file:
                        report_file.truncate(50 * 1024 * 1024 + 1)

                result = run_script(root)

                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((root / "timings.json").exists())

    def test_invalid_measured_durations_are_rejected(self):
        invalid_times = (None, "0", "-1", "nan", "inf", "not-a-number")
        for invalid_time in invalid_times:
            with self.subTest(invalid_time=invalid_time), tempfile.TemporaryDirectory() as temporary_directory:
                root = Path(temporary_directory)
                create_tests_directory(root, "alpha.spec.ts")
                time_attribute = "" if invalid_time is None else f' time="{invalid_time}"'
                write_shard(
                    root,
                    f"""<testsuites tests="1" failures="0" errors="0" skipped="0">
  <testsuite name="alpha.spec.ts" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="measured"{time_attribute} />
  </testsuite>
</testsuites>
""",
                )

                result = run_script(root)

                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((root / "timings.json").exists())


if __name__ == "__main__":
    unittest.main()
