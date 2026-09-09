"""Assess operator-collected CI evidence offline; local JSON is not attestation."""

import argparse
import json
import re
import stat
from collections import Counter
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree

MAX_FILE_BYTES = 16 * 1024 * 1024
MAX_TOTAL_BYTES = 256 * 1024 * 1024
CATEGORIES = {
    "spec-only",
    "feature",
    "shared",
    "docs",
    "new-spec",
    "deleted-spec",
    "unknown",
}
SELECTIVE_CATEGORIES = {"spec-only", "feature", "shared"}
CONTROL_CATEGORIES = CATEGORIES - SELECTIVE_CATEGORIES
SHA_FIELDS = ("headSha", "baseSha", "mergeBase", "trustedControlSha")
COUNT_FIELDS = ("tests", "failures", "errors", "skipped")


class EvidenceError(ValueError):
    def __init__(self, reason, status="hard-rejection"):
        self.reason = reason
        self.status = status


def require(condition, reason, status="hard-rejection"):
    if not condition:
        raise EvidenceError(reason, status)


def positive(value):
    return type(value) is int and value > 0


def unique_strings(value, reason, allow_empty=False):
    require(isinstance(value, list) and len(value) <= 512, reason)
    require(
        all(isinstance(item, str) and 0 < len(item) <= 512 for item in value), reason
    )
    require(len(value) == len(set(value)) and (value or allow_empty), reason)
    return set(value)


def specs(value, allow_empty=False):
    result = unique_strings(value, "invalid-specs", allow_empty)
    require(
        all(
            re.fullmatch(r"tests/[A-Za-z0-9_./-]+\.spec\.ts", item)
            and ".." not in PurePosixPath(item).parts
            for item in result
        ),
        "invalid-specs",
    )
    return result


def profiles(value):
    require(isinstance(value, str) and len(value) <= 512, "invalid-profile")
    parts = value.split(",")
    require(
        all(re.fullmatch(r"[a-z][a-z0-9-]*", part) for part in parts)
        and parts == sorted(set(parts)),
        "invalid-profile",
    )
    return set(parts)


def parse_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate-json-key")
            result[key] = value
        return result

    try:
        return json.loads(
            data.decode("utf-8"),
            object_pairs_hook=pairs,
            parse_constant=lambda _: require(False, "invalid-json"),
        )
    except (UnicodeError, json.JSONDecodeError, RecursionError):
        raise EvidenceError("invalid-json") from None


class Files:
    def __init__(self, root):
        self.root = root.resolve()
        self.total = 0

    def read(self, name):
        require(
            isinstance(name, str) and 0 < len(name) <= 1024 and "\\" not in name,
            "unsafe-path",
        )
        path = PurePosixPath(name)
        require(not path.is_absolute() and ".." not in path.parts, "unsafe-path")
        try:
            resolved = (self.root / name).resolve(strict=True)
            require(resolved.is_relative_to(self.root), "unsafe-path")
            info = resolved.stat()
            require(stat.S_ISREG(info.st_mode), "unsafe-path")
            require(info.st_size <= MAX_FILE_BYTES, "input-limit")
            with resolved.open("rb") as stream:
                data = stream.read(MAX_FILE_BYTES + 1)
        except OSError:
            raise EvidenceError("missing-file", "missing-evidence") from None
        self.total += len(data)
        require(
            len(data) <= MAX_FILE_BYTES and self.total <= MAX_TOTAL_BYTES, "input-limit"
        )
        return data


def validate_plan(plan, event, candidates=None):
    require(isinstance(plan, dict) and plan.get("schemaVersion") == 1, "invalid-plan")
    require(
        all(plan.get(key) == event[key] for key in SHA_FIELDS[:3]),
        "plan-identity-mismatch",
    )
    actual = specs(plan.get("candidateSpecs"))
    require(candidates is None or candidates == actual, "candidate-mismatch")
    selected = specs(plan.get("selectedSpecs"), True)
    require(selected <= actual, "selected-spec-mismatch")
    mode = plan.get("mode")
    require(
        isinstance(mode, str) and mode in {"selected", "full", "skip"}, "invalid-mode"
    )
    require(
        (mode == "full" and selected == actual)
        or (mode == "skip" and not selected)
        or (mode == "selected" and bool(selected) and selected < actual),
        "invalid-selection",
    )
    assignments = plan.get("profileAssignments")
    require(
        isinstance(assignments, dict) and set(assignments) == actual, "profile-mismatch"
    )
    for profile in assignments.values():
        profiles(profile)
    require(
        unique_strings(plan.get("selectedProfiles"), "profile-mismatch", True)
        == {assignments[item] for item in selected},
        "profile-mismatch",
    )
    shards = plan.get("shards")
    require(isinstance(shards, list) and len(shards) <= 8, "invalid-shards")
    count = len(shards)
    require(
        type(plan.get("shardCount")) is int and plan["shardCount"] == count,
        "invalid-shards",
    )
    require(
        (mode == "full" and count == 8)
        or (mode == "skip" and count == 0)
        or (mode == "selected" and 1 <= count <= 4),
        "incomplete-shards",
        "missing-evidence",
    )
    partition = set()
    indexed = {}
    for shard in shards:
        require(isinstance(shard, dict), "invalid-shard")
        index = shard.get("shardIndex")
        require(
            positive(index)
            and index <= count
            and index not in indexed
            and type(shard.get("shardTotal")) is int
            and shard["shardTotal"] == count
            and shard.get("version") == 1,
            "invalid-shard",
        )
        files = specs(shard.get("files"))
        require(files <= selected and not files & partition, "shard-partition-mismatch")
        union = set().union(*(profiles(assignments[item]) for item in files))
        require(profiles(shard.get("profile")) == union, "shard-profile-mismatch")
        indexed[index] = files
        partition |= files
    require(partition == selected, "shard-partition-mismatch")
    return actual, selected, indexed


def read_junit(data, expected):
    try:
        text = data.decode("utf-8-sig")
        require(
            "\x00" not in text
            and not re.search(r"<!\s*(DOCTYPE|ENTITY)\b", text, re.IGNORECASE),
            "unsafe-xml",
        )
        declaration = re.match(r"\s*<\?xml[^?]*\?>", text)
        if declaration:
            encoding = re.search(
                r"encoding\s*=\s*['\"]([^'\"]+)", declaration[0], re.IGNORECASE
            )
            require(
                not encoding or encoding[1].lower() in {"utf-8", "utf8"}, "unsafe-xml"
            )
        root = ElementTree.fromstring(text)
    except (UnicodeError, ElementTree.ParseError, RecursionError):
        raise EvidenceError("invalid-xml") from None
    require(
        root.tag == "testsuites" and all(child.tag == "testsuite" for child in root),
        "invalid-junit",
    )

    def declared(node):
        values = []
        for key in COUNT_FIELDS:
            raw = node.get(key, "")
            require(bool(re.fullmatch(r"[0-9]{1,8}", raw)), "invalid-junit-counts")
            values.append(int(raw))
        return values

    totals = [0] * 4
    seen, failed, exercised = set(), set(), set()
    for suite in root:
        name = suite.get("name", "")
        spec = name if name.startswith("tests/") else f"tests/{name}"
        require(spec in expected and spec not in seen, "junit-spec-mismatch")
        seen.add(spec)
        cases = suite.findall("testcase")
        require(
            all(
                child.tag in {"testcase", "system-out", "system-err", "properties"}
                for child in suite
            ),
            "invalid-junit",
        )
        observed = [len(cases), 0, 0, 0]
        for case in cases:
            require(
                all(
                    child.tag
                    in {
                        "failure",
                        "error",
                        "skipped",
                        "system-out",
                        "system-err",
                        "properties",
                    }
                    for child in case
                ),
                "invalid-junit",
            )
            outcomes = [
                len(case.findall(tag)) for tag in ("failure", "error", "skipped")
            ]
            require(sum(outcomes) <= 1, "invalid-junit-outcome")
            for index, count in enumerate(outcomes, 1):
                observed[index] += count
        require(declared(suite) == observed, "junit-count-mismatch")
        totals = [a + b for a, b in zip(totals, observed)]
        if observed[1] or observed[2]:
            failed.add(spec)
        if observed[0] > observed[3]:
            exercised.add(spec)
    require(seen == expected, "incomplete-junit", "missing-evidence")
    require(declared(root) == totals, "junit-count-mismatch")
    return failed, exercised, totals


def evaluate_entry(entry, files):
    require(isinstance(entry, dict), "invalid-entry")
    event, run = entry.get("event"), entry.get("fullRun")
    require(
        isinstance(event, dict) and isinstance(run, dict),
        "missing-provenance",
        "missing-evidence",
    )
    require(
        all(
            isinstance(event.get(key), str)
            and re.fullmatch(r"[0-9a-f]{40}", event[key])
            for key in SHA_FIELDS
        ),
        "missing-provenance",
        "missing-evidence",
    )
    repository = event.get("repository")
    require(
        isinstance(repository, str)
        and re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository)
        and event.get("headRepository") == repository
        and positive(event.get("pullRequestNumber")),
        "invalid-provenance",
    )
    require(
        event.get("actualDraft") is True
        and isinstance(event.get("baseRef"), str)
        and event["baseRef"] in {"v3", "v3-ai"},
        "ineligible-event",
        "missing-evidence",
    )
    require(
        run.get("completed") is True
        and run.get("mode") == "full"
        and positive(run.get("runId"))
        and positive(run.get("runAttempt")),
        "incomplete-run",
        "missing-evidence",
    )
    require(
        isinstance(entry.get("category"), str) and entry["category"] in CATEGORIES,
        "missing-category",
        "missing-evidence",
    )
    artifacts = entry.get("artifacts")
    require(
        isinstance(artifacts, list) and len(artifacts) == 10,
        "incomplete-artifacts",
        "missing-evidence",
    )
    ids, paths, reports, plans = set(), set(), {}, {}
    for artifact in artifacts:
        require(
            isinstance(artifact, dict) and positive(artifact.get("artifactId")),
            "missing-artifact-identity",
            "missing-evidence",
        )
        require(artifact["artifactId"] not in ids, "duplicate-artifact")
        ids.add(artifact["artifactId"])
        require(
            all(
                type(artifact.get(key)) is int and artifact[key] == run[key]
                for key in ("runId", "runAttempt")
            ),
            "artifact-identity-mismatch",
        )
        require(
            artifact.get("expired") is False, "expired-artifact", "missing-evidence"
        )
        path = artifact.get("path")
        require(isinstance(path, str) and path not in paths, "duplicate-artifact-path")
        paths.add(path)
        kind = artifact.get("kind")
        require(isinstance(kind, str), "invalid-artifact-kind")
        if kind == "junit":
            index = artifact.get("shardIndex")
            require(
                positive(index) and index <= 8 and index not in reports,
                "invalid-report-shard",
            )
            reports[index] = path
        else:
            require(
                kind in {"canonical-plan", "shadow-plan"} and kind not in plans,
                "invalid-artifact-kind",
            )
            plans[kind] = parse_json(files.read(path))
    require(
        len(plans) == 2 and len(reports) == 8,
        "incomplete-artifacts",
        "missing-evidence",
    )
    canonical, shadow = plans["canonical-plan"], plans["shadow-plan"]
    candidates, _, shards = validate_plan(canonical, event)
    require(canonical["mode"] == "full", "canonical-not-full")
    _, selected, _ = validate_plan(shadow, event, candidates)
    require(
        canonical["profileAssignments"] == shadow["profileAssignments"],
        "profile-mismatch",
    )
    failed, exercised, counts = set(), set(), [0] * 4
    for index, expected in shards.items():
        failures, ran, totals = read_junit(files.read(reports[index]), expected)
        failed |= failures
        exercised |= ran
        counts = [a + b for a, b in zip(counts, totals)]
    missed = failed - selected
    result = {
        "repository": repository,
        "baseRef": event["baseRef"],
        "pullRequestNumber": event["pullRequestNumber"],
        "headSha": event["headSha"],
        "runId": run["runId"],
        "runAttempt": run["runAttempt"],
        "category": entry["category"],
        "fullFailureSpecs": sorted(failed),
        "fullFailureSpecsOutsideSelected": sorted(missed),
        "counts": dict(zip(COUNT_FIELDS, counts)),
        "reasons": [],
    }
    if missed:
        result.update(status="hard-rejection", reasons=["missed-failure"])
    elif exercised != candidates:
        result.update(status="missing-evidence", reasons=["unexercised-spec"])
    elif shadow["mode"] == "full":
        result["status"] = "full-fallback-control"
    elif shadow["mode"] == "skip":
        require(entry["category"] == "docs", "unexpected-skip")
        result["status"] = "skip-control"
    else:
        result["status"] = "eligible-selective"
    return result


def evaluate(manifest_path):
    path = Path(manifest_path)
    files = Files(path.parent)
    manifest = parse_json(files.read(path.name))
    require(
        isinstance(manifest, dict)
        and manifest.get("schemaVersion") == 1
        and isinstance(manifest.get("entries"), list)
        and len(manifest["entries"]) <= 128,
        "invalid-manifest",
    )
    results, groups = [], {}
    for entry in manifest["entries"]:
        event = entry.get("event", {}) if isinstance(entry, dict) else {}
        population = (
            (event.get("repository"), event.get("baseRef"))
            if isinstance(event, dict)
            else (None, None)
        )
        require(
            all(value is None or isinstance(value, str) for value in population),
            "invalid-provenance",
        )
        try:
            result = evaluate_entry(entry, files)
        except EvidenceError as error:
            result = {"status": error.status, "reasons": [error.reason]}
        results.append(result)
        groups.setdefault(population, []).append(result)
    cohorts = []
    for (repository, base), entries in groups.items():
        eligible, controls, seen = [], set(), set()
        for result in entries:
            if result["status"] in {"full-fallback-control", "skip-control"}:
                controls.add(result["category"])
            if result["status"] != "eligible-selective":
                continue
            key = (result["pullRequestNumber"], result["headSha"])
            if key not in seen:
                eligible.append(result)
                seen.add(key)
        categories = {result["category"] for result in eligible}
        missing = sorted(
            (SELECTIVE_CATEGORIES - categories) | (CONTROL_CATEGORIES - controls)
        )
        rejected = any(result["status"] == "hard-rejection" for result in entries)
        cohorts.append(
            {
                "repository": repository,
                "baseRef": base,
                "eligibleSelectiveHeads": len(eligible),
                "missingCategories": missing,
                "statuses": dict(Counter(result["status"] for result in entries)),
                "qualified": len(eligible) >= 10 and not missing and not rejected,
            }
        )
    return {
        "schemaVersion": 1,
        "offlineOnly": True,
        "entries": results,
        "cohorts": cohorts,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    try:
        report = evaluate(args.manifest)
    except EvidenceError as error:
        print(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "offlineOnly": True,
                    "status": error.status,
                    "reasons": [error.reason],
                }
            )
        )
        return 2
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
