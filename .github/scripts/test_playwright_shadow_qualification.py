import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

module_spec = importlib.util.spec_from_file_location(
    "qualification", Path(__file__).with_name("playwright-shadow-qualification.py")
)
qualification = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(qualification)
evaluate = qualification.evaluate


SPECS = [f"tests/spec-{index}.spec.ts" for index in range(1, 9)]
SHA_FIELDS = {
    "headSha": "a" * 40,
    "baseSha": "b" * 40,
    "mergeBase": "c" * 40,
    "trustedControlSha": "d" * 40,
}


def _xml_report(specs, failure_specs=(), skipped_specs=()):
    failure_specs = set(failure_specs)
    skipped_specs = set(skipped_specs)
    suites = []
    total = failures = errors = skipped = 0
    for spec in specs:
        if spec in failure_specs:
            suites.append(
                f'<testsuite name="{spec}" tests="1" failures="1" '
                'errors="0" skipped="0"><testcase name="case">'
                "<failure>synthetic failure</failure></testcase></testsuite>"
            )
            failures += 1
        elif spec in skipped_specs:
            suites.append(
                f'<testsuite name="{spec}" tests="1" failures="0" '
                'errors="0" skipped="1"><testcase name="case">'
                "<skipped /></testcase></testsuite>"
            )
            skipped += 1
        else:
            suites.append(
                f'<testsuite name="{spec}" tests="1" failures="0" '
                'errors="0" skipped="0"><testcase name="case" />'
                "</testsuite>"
            )
        total += 1
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<testsuites tests="{total}" failures="{failures}" '
        f'errors="{errors}" skipped="{skipped}">'
        f"{''.join(suites)}</testsuites>"
    )


class Fixture:
    def __init__(self, root, *, number=1, category="feature", mode="selected"):
        self.root = Path(root)
        self.number = number
        self.category = category
        self.mode = mode
        self.run_id = number
        self.run_attempt = 1
        self.event = {
            "repository": "example/repo",
            "headRepository": "example/repo",
            "pullRequestNumber": number,
            "actualDraft": True,
            "baseRef": "v3",
            **SHA_FIELDS,
        }

    def entry(
        self,
        *,
        selected=None,
        failure_specs=(),
        shadow_run_attempt=None,
        missing_shard=False,
        expired=False,
        unsafe_path=False,
        unsafe_xml=False,
    ):
        selected = list(
            SPECS
            if self.mode == "full"
            else ([] if self.mode == "skip" else selected or [SPECS[0], SPECS[1]])
        )
        assignments = {
            spec: "chat" if index % 2 else "manage" for index, spec in enumerate(SPECS)
        }
        artifact_dir = self.root / f"artifacts-{self.number}"
        artifact_dir.mkdir()
        descriptors = []

        def add_artifact(
            artifact_id, kind, path, artifact_attempt=None, expired_value=False
        ):
            descriptors.append(
                {
                    "artifactId": self.number * 100 + len(descriptors) + 1,
                    "kind": kind,
                    "path": path,
                    "runId": self.run_id,
                    "runAttempt": artifact_attempt or self.run_attempt,
                    "expired": expired_value,
                }
            )

        canonical_path = artifact_dir / "canonical.json"
        shadow_path = artifact_dir / "shadow.json"
        report_ids = []
        shards = []
        for index in range(1, 9):
            shard_specs = [SPECS[index - 1]]
            report_id = f"junit-{index}"
            report_ids.append(report_id)
            report_name = f"shard-{index}.xml"
            report_path = artifact_dir / report_name
            xml = _xml_report(shard_specs, failure_specs=failure_specs)
            if unsafe_xml and index == 1:
                xml = '<!DOCTYPE testsuites [<!ENTITY bad "x">]>' + xml
            report_path.write_text(xml, encoding="utf-8")
            add_artifact(report_id, "junit", str(report_path.relative_to(self.root)))
            descriptors[-1]["shardIndex"] = index
            shards.append(
                {
                    "shardIndex": index,
                    "shardTotal": 8,
                    "version": 1,
                    "files": shard_specs,
                    "profile": assignments[shard_specs[0]],
                }
            )

        identity = {key: self.event[key] for key in ("headSha", "baseSha", "mergeBase")}
        canonical = {
            "schemaVersion": 1,
            "kind": "canonical",
            "mode": "full",
            **identity,
            "candidateSpecs": SPECS,
            "selectedSpecs": SPECS,
            "profileAssignments": assignments,
            "selectedProfiles": ["chat", "manage"],
            "shardCount": 8,
            "shards": shards,
        }
        shadow = {
            "schemaVersion": 1,
            "kind": "shadow",
            "mode": self.mode,
            **identity,
            "candidateSpecs": SPECS,
            "selectedSpecs": [] if self.mode == "skip" else selected,
            "selectedProfiles": sorted({assignments[spec] for spec in selected}),
            "profileAssignments": assignments,
            "shardCount": 0
            if self.mode == "skip"
            else (8 if self.mode == "full" else 1),
            "shards": []
            if self.mode == "skip"
            else (
                shards
                if self.mode == "full"
                else [
                    {
                        "version": 1,
                        "shardIndex": 1,
                        "shardTotal": 1,
                        "files": selected,
                        "profile": ",".join(
                            sorted({assignments[spec] for spec in selected})
                        ),
                    }
                ]
            ),
        }
        canonical_path.write_text(json.dumps(canonical), encoding="utf-8")
        shadow_path.write_text(json.dumps(shadow), encoding="utf-8")
        add_artifact(
            "canonical-plan",
            "canonical-plan",
            str(canonical_path.relative_to(self.root)),
        )
        add_artifact(
            "shadow-plan",
            "shadow-plan",
            str(shadow_path.relative_to(self.root)),
            artifact_attempt=shadow_run_attempt,
            expired_value=expired,
        )
        if unsafe_path:
            descriptors[-1]["path"] = "../outside.json"
        if missing_shard:
            descriptors.pop(0)
        return {
            "event": self.event,
            "fullRun": {
                "runId": self.run_id,
                "runAttempt": self.run_attempt,
                "mode": "full",
                "completed": True,
            },
            "candidateSpecs": SPECS,
            "category": self.category,
            "artifacts": descriptors,
        }


def _write_manifest(root, entries):
    path = Path(root) / "manifest.json"
    path.write_text(
        json.dumps({"schemaVersion": 1, "entries": entries}), encoding="utf-8"
    )
    return path


class PlaywrightShadowQualificationTests(unittest.TestCase):
    def test_selective_success_preserves_failure_inside_selection(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            entry = fixture.entry(selected=[SPECS[0]], failure_specs=[SPECS[0]])
            report = evaluate(_write_manifest(directory, [entry]))
            result = report["entries"][0]
            self.assertEqual(result["status"], "eligible-selective")
            self.assertEqual(result["fullFailureSpecs"], [SPECS[0]])
            self.assertEqual(result["fullFailureSpecsOutsideSelected"], [])

    def test_missed_failure_outside_subset_is_hard_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            entry = fixture.entry(selected=[SPECS[0]], failure_specs=[SPECS[1]])
            report = evaluate(_write_manifest(directory, [entry]))
            result = report["entries"][0]
            self.assertEqual(result["status"], "hard-rejection")
            self.assertIn("missed-failure", result["reasons"])

    def test_identity_attempt_mismatch_is_hard_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            entry = fixture.entry(shadow_run_attempt=2)
            report = evaluate(_write_manifest(directory, [entry]))
            self.assertEqual(report["entries"][0]["status"], "hard-rejection")
            self.assertIn("artifact-identity-mismatch", report["entries"][0]["reasons"])

    def test_missing_shards_and_expired_artifact_are_missing_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory, number=1)
            entry = fixture.entry(missing_shard=True)
            result = evaluate(_write_manifest(directory, [entry]))["entries"][0]
            self.assertEqual(result["status"], "missing-evidence")
            self.assertIn("incomplete-artifacts", result["reasons"])

            fixture = Fixture(directory, number=2)
            entry = fixture.entry(expired=True)
            result = evaluate(_write_manifest(directory, [entry]))["entries"][0]
            self.assertEqual(result["status"], "missing-evidence")
            self.assertIn("expired-artifact", result["reasons"])

    def test_cohort_deduplicates_heads_and_requires_coverage_controls(self):
        with tempfile.TemporaryDirectory() as directory:
            entries = []
            for number in range(1, 10):
                category = "spec-only" if number == 1 else "feature"
                entries.append(
                    Fixture(directory, number=number, category=category).entry()
                )
            entries.append(entries[0])
            report = evaluate(_write_manifest(directory, entries))
            group = report["cohorts"][0]
            self.assertFalse(group["qualified"])
            self.assertEqual(group["eligibleSelectiveHeads"], 9)
            self.assertEqual(
                set(group["missingCategories"]),
                {"shared", "docs", "new-spec", "deleted-spec", "unknown"},
            )
            for number, category in enumerate(
                ("docs", "new-spec", "deleted-spec", "unknown"), 11
            ):
                entries.append(
                    Fixture(
                        directory,
                        number=number,
                        category=category,
                        mode="skip" if category == "docs" else "full",
                    ).entry()
                )
            different = Fixture(directory, number=15, category="shared")
            different.event["baseRef"] = "v3-ai"
            entries.append(different.entry())
            self.assertTrue(
                all(
                    not group["qualified"]
                    for group in evaluate(_write_manifest(directory, entries))[
                        "cohorts"
                    ]
                )
            )
            entries.append(Fixture(directory, number=16, category="shared").entry())
            self.assertTrue(
                evaluate(_write_manifest(directory, entries))["cohorts"][0]["qualified"]
            )
            entries.append(
                Fixture(directory, number=17).entry(failure_specs=[SPECS[7]])
            )
            self.assertFalse(
                evaluate(_write_manifest(directory, entries))["cohorts"][0]["qualified"]
            )

    def test_unsafe_path_and_xml_cannot_qualify(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Fixture(directory)
            entry = fixture.entry(unsafe_path=True)
            result = evaluate(_write_manifest(directory, [entry]))["entries"][0]
            self.assertEqual(result["status"], "hard-rejection")
            self.assertIn("unsafe-path", result["reasons"])

            fixture = Fixture(directory, number=2)
            entry = fixture.entry(unsafe_xml=True)
            result = evaluate(_write_manifest(directory, [entry]))["entries"][0]
            self.assertEqual(result["status"], "hard-rejection")
            self.assertIn("unsafe-xml", result["reasons"])

    def test_full_fallback_and_documentation_skip_are_controls(self):
        with tempfile.TemporaryDirectory() as directory:
            full = Fixture(
                directory, number=1, category="new-spec", mode="full"
            ).entry()
            skipped = Fixture(directory, number=2, category="docs", mode="skip").entry()
            report = evaluate(_write_manifest(directory, [full, skipped]))
            self.assertEqual(report["entries"][0]["status"], "full-fallback-control")
            self.assertEqual(report["entries"][1]["status"], "skip-control")

    def test_skipped_specs_and_inconsistent_counts_do_not_prove_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            entry = Fixture(directory).entry()
            report_path = Path(directory) / entry["artifacts"][0]["path"]
            report_path.write_text(_xml_report([SPECS[0]], skipped_specs=[SPECS[0]]))
            self.assertEqual(
                evaluate(_write_manifest(directory, [entry]))["entries"][0]["status"],
                "missing-evidence",
            )
            report_path.write_text(
                _xml_report([SPECS[0]]).replace('tests="1"', 'tests="2"', 1)
            )
            self.assertEqual(
                evaluate(_write_manifest(directory, [entry]))["entries"][0]["reasons"],
                ["junit-count-mismatch"],
            )

    def test_event_identity_and_profile_contract_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            entries = []
            for number, (key, value) in enumerate(
                (("actualDraft", None), ("actualDraft", False), ("headSha", "z" * 40)),
                1,
            ):
                fixture = Fixture(directory, number=number)
                entry = fixture.entry()
                entry["event"][key] = value
                entry["event"]["selectorPrState"] = "draft"
                entries.append(entry)
            entry = Fixture(directory, number=4).entry()
            path = Path(directory) / entry["artifacts"][-1]["path"]
            plan = json.loads(path.read_text())
            plan["shards"][0]["profile"] = "other"
            path.write_text(json.dumps(plan))
            entries.append(entry)
            self.assertTrue(
                all(
                    item["status"] != "eligible-selective"
                    for item in evaluate(_write_manifest(directory, entries))["entries"]
                )
            )

    def test_encoded_xml_symlink_escape_and_size_limit_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            entries = []
            for number, data in enumerate(
                (
                    b'<?xml version="1.0" encoding="UTF-16"?><testsuites/>',
                    "<!DOCTYPE testsuites><testsuites/>".encode("utf-16"),
                ),
                1,
            ):
                entry = Fixture(directory, number=number).entry()
                (Path(directory) / entry["artifacts"][0]["path"]).write_bytes(data)
                entries.append(entry)
            entry = Fixture(directory, number=3).entry()
            link = Path(directory) / "outside"
            link.symlink_to(Path(directory).parent)
            entry["artifacts"][0]["path"] = "outside"
            entries.append(entry)
            entry = Fixture(directory, number=4).entry()
            with (Path(directory) / entry["artifacts"][0]["path"]).open("wb") as stream:
                stream.truncate(qualification.MAX_FILE_BYTES + 1)
            entries.append(entry)
            self.assertTrue(
                all(
                    item["status"] == "hard-rejection"
                    for item in evaluate(_write_manifest(directory, entries))["entries"]
                )
            )


if __name__ == "__main__":
    unittest.main()
