#!/usr/bin/env python3

import argparse
import json
import math
import os
import re
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree

EXPECTED_TIMING_VERSION = 1
MAX_JUNIT_BYTES = 50 * 1024 * 1024
SHARD_ARTIFACT_PATTERN = re.compile(
    r"(?:^|/)playwright-results-(\d+)-of-(\d+)(?:/|$)"
)


def fail(message: str) -> None:
    raise ValueError(message)


def parse_count(attributes: dict[str, str], name: str, context: str) -> int:
    raw_value = attributes.get(name)
    if raw_value is None:
        fail(f"{context} is missing the {name} count")

    try:
        value = int(raw_value)
    except ValueError as error:
        raise ValueError(f"{context} has an invalid {name} count") from error

    if value < 0:
        fail(f"{context} has a negative {name} count")
    return value


def parse_duration(raw_value: str | None, context: str) -> float:
    if raw_value is None:
        fail(f"{context} is missing a time")

    try:
        value = float(raw_value)
    except (OverflowError, ValueError) as error:
        raise ValueError(f"{context} has an invalid time") from error

    if not math.isfinite(value) or value <= 0:
        fail(f"{context} must have a positive finite time")
    return value


def parse_skipped_duration(raw_value: str | None, context: str) -> None:
    if raw_value is None:
        return

    try:
        value = float(raw_value)
    except (OverflowError, ValueError) as error:
        raise ValueError(f"{context} has an invalid time") from error

    if not math.isfinite(value) or value < 0:
        fail(f"{context} must have a finite non-negative time")


def active_specs(tests_dir: Path) -> list[str]:
    return sorted(
        path.name for path in tests_dir.iterdir() if path.name.endswith(".spec.ts")
    )


def find_junit_files(artifact_dir: Path) -> list[Path]:
    junit_files = sorted(artifact_dir.rglob("junit.xml"))
    if not junit_files:
        fail("found no JUnit artifacts")

    shard_totals: set[int] = set()
    for junit_file in junit_files:
        relative_path = junit_file.relative_to(artifact_dir).as_posix()
        match = SHARD_ARTIFACT_PATTERN.search(relative_path)
        if match is None:
            fail("JUnit artifact is not under a shard artifact directory")
        shard_totals.add(int(match.group(2)))

    if len(shard_totals) != 1:
        fail("JUnit artifacts report different shard totals")
    expected_shards = shard_totals.pop()
    if expected_shards < 1:
        fail("JUnit artifacts report an invalid shard total")

    shard_indexes: set[int] = set()
    for junit_file in junit_files:
        relative_path = junit_file.relative_to(artifact_dir).as_posix()
        match = SHARD_ARTIFACT_PATTERN.search(relative_path)
        if match is None:
            fail(f"JUnit artifact is not under a shard artifact directory")

        shard_index = int(match.group(1))
        shard_total = int(match.group(2))
        if shard_total != expected_shards:
            fail(
                f"{relative_path} reports {shard_total} shards, "
                f"expected {expected_shards}"
            )
        if shard_index < 1 or shard_index > expected_shards:
            fail(f"{relative_path} has an invalid shard index")
        if shard_index in shard_indexes:
            fail(f"duplicate JUnit artifact for shard {shard_index}")
        shard_indexes.add(shard_index)

        if junit_file.stat().st_size > MAX_JUNIT_BYTES:
            fail(f"{relative_path} exceeds the JUnit size limit")

    expected_indexes = set(range(1, expected_shards + 1))
    if shard_indexes != expected_indexes:
        fail("JUnit artifacts do not cover every shard")
    return junit_files


def collect_durations(
    junit_files: list[Path], expected_specs: set[str]
) -> tuple[dict[str, float], set[str]]:
    durations: dict[str, float] = {}
    skipped_only_specs: set[str] = set()
    total_bytes = 0
    count_names = ("tests", "failures", "errors", "skipped")

    for junit_file in junit_files:
        total_bytes += junit_file.stat().st_size
        try:
            root = ElementTree.parse(junit_file).getroot()
        except ElementTree.ParseError as error:
            fail(f"malformed JUnit XML in {junit_file.name}")
        if root.tag != "testsuites":
            fail(f"{junit_file.name} has an unexpected JUnit root element")

        declared_root_counts = {
            count_name: parse_count(root.attrib, count_name, junit_file.name)
            for count_name in count_names
        }
        for count_name in ("failures", "errors"):
            if declared_root_counts[count_name] != 0:
                fail(f"{junit_file.name} contains non-zero {count_name}")

        suites = root.findall("testsuite")
        if not suites:
            fail(f"{junit_file.name} contains no test suites")

        observed_root_counts = {count_name: 0 for count_name in count_names}
        for suite in suites:
            suite_name = suite.attrib.get("name", "")
            spec_name = Path(suite_name).name
            if spec_name not in expected_specs:
                fail(f"{junit_file.name} contains unknown spec {suite_name}")
            if spec_name in durations or spec_name in skipped_only_specs:
                fail(f"duplicate JUnit suite for {spec_name}")

            declared_suite_counts = {
                count_name: parse_count(suite.attrib, count_name, spec_name)
                for count_name in count_names
            }
            for count_name in ("failures", "errors"):
                if declared_suite_counts[count_name] != 0:
                    fail(f"{spec_name} contains non-zero {count_name}")

            testcases = suite.findall("testcase")
            if not testcases:
                fail(f"{spec_name} contains no testcases")

            suite_duration = 0.0
            observed_suite_counts = {
                count_name: 0
                for count_name in ("tests", "failures", "errors", "skipped")
            }
            for testcase in testcases:
                classname = testcase.attrib.get("classname")
                if classname is not None and Path(classname).name != spec_name:
                    fail(f"{spec_name} contains a testcase from {classname}")

                observed_suite_counts["tests"] += 1
                has_skipped = testcase.find("skipped") is not None
                has_failure = testcase.find("failure") is not None
                has_error = testcase.find("error") is not None
                if has_failure or has_error:
                    fail(f"{spec_name} contains a test failure or error")

                if has_skipped:
                    observed_suite_counts["skipped"] += 1
                    parse_skipped_duration(
                        testcase.attrib.get("time"), f"{spec_name} skipped testcase"
                    )
                else:
                    suite_duration += parse_duration(
                        testcase.attrib.get("time"), f"{spec_name} testcase"
                    )

            if declared_suite_counts != observed_suite_counts:
                fail(f"{spec_name} counts do not match testcase outcomes")

            for count_name in count_names:
                observed_root_counts[count_name] += observed_suite_counts[count_name]

            if observed_suite_counts["skipped"] == observed_suite_counts["tests"]:
                skipped_only_specs.add(spec_name)
            else:
                durations[spec_name] = suite_duration

        if declared_root_counts != observed_root_counts:
            fail(f"{junit_file.name} counts do not match testcase outcomes")

    if total_bytes > MAX_JUNIT_BYTES * len(junit_files):
        fail("combined JUnit artifacts exceed the size limit")
    return durations, skipped_only_specs


def write_timings(output_path: Path, durations: dict[str, float]) -> None:
    payload = {
        "version": EXPECTED_TIMING_VERSION,
        "durations": [
            {
                "spec": f"tests/{spec_name}",
                "duration": round(durations[spec_name], 3),
            }
            for spec_name in sorted(durations)
        ],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, indent=2, allow_nan=False) + "\n"
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=output_path.parent,
            prefix=f".{output_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            temporary_file.write(serialized)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_path, output_path)
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink()
            except FileNotFoundError:
                pass


def read_prior_durations(
    output_path: Path, expected_specs: set[str]
) -> dict[str, float]:
    try:
        serialized = output_path.read_text(encoding="utf-8")
    except (FileNotFoundError, UnicodeDecodeError):
        return {}

    try:
        payload = json.loads(serialized)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}

    if (
        not isinstance(payload, dict)
        or isinstance(payload.get("version"), bool)
        or payload.get("version") != EXPECTED_TIMING_VERSION
    ):
        return {}
    entries = payload.get("durations")
    if not isinstance(entries, list):
        return {}

    durations: dict[str, float] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            return {}
        spec = entry.get("spec")
        if not isinstance(spec, str) or not spec.startswith("tests/"):
            return {}
        spec_name = spec.removeprefix("tests/")
        if spec_name not in expected_specs:
            continue
        if spec_name in durations:
            return {}

        raw_duration = entry.get("duration")
        if isinstance(raw_duration, bool) or not isinstance(
            raw_duration, (int, float)
        ):
            return {}
        try:
            duration = float(raw_duration)
        except OverflowError:
            return {}
        if not math.isfinite(duration) or duration <= 0:
            return {}
        durations[spec_name] = duration

    return durations


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build playwright/timings.json from a complete JUnit run"
    )
    parser.add_argument("artifact_dir", type=Path)
    parser.add_argument("output_path", type=Path)
    args = parser.parse_args()

    tests_dir = args.output_path.parent / "tests"
    if not tests_dir.is_dir():
        fail(f"active spec directory does not exist: {tests_dir}")

    expected_specs = set(active_specs(tests_dir))
    if not expected_specs:
        fail("active spec directory contains no spec files")

    junit_files = find_junit_files(args.artifact_dir)
    fresh_durations, skipped_only_specs = collect_durations(
        junit_files, expected_specs
    )
    covered_specs = fresh_durations.keys() | skipped_only_specs
    missing_specs = sorted(expected_specs - covered_specs)
    if missing_specs:
        fail(f"JUnit artifacts are missing specs: {', '.join(missing_specs)}")

    prior_durations = read_prior_durations(args.output_path, expected_specs)
    missing_prior = sorted(skipped_only_specs - prior_durations.keys())
    if missing_prior:
        fail(
            "skipped-only specs lack valid prior timings: "
            + ", ".join(missing_prior)
        )

    if not fresh_durations:
        print(
            f"No Playwright timing update: all {len(expected_specs)} specs "
            "were skipped; existing timings unchanged"
        )
        return

    durations = dict(fresh_durations)
    durations.update(
        {spec_name: prior_durations[spec_name] for spec_name in skipped_only_specs}
    )
    write_timings(args.output_path, durations)
    print(
        f"Wrote {len(durations)} Playwright spec timings from "
        f"{len(junit_files)} shards to {args.output_path}"
    )


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print(f"Invalid Playwright timing artifacts: {error}", file=sys.stderr)
        sys.exit(1)
