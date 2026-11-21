"""Offline input-budget invariants; no model or quality evaluator is called."""

import copy
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/prepare-graph-comparison.py"
spec = importlib.util.spec_from_file_location("prepare_graph_comparison", SCRIPT)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class MatchedInputContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.object(
            socket.socket, "connect", side_effect=AssertionError("Network forbidden")
        ):
            cls.encoding = helper.offline_encoding()

    def document(self, passages=None):
        return {
            "cases": [
                {
                    "id": "synthetic",
                    "question": "Explain the connection?",
                    "arms": {arm: list(passages or []) for arm in helper.ARMS},
                }
            ]
        }

    def test_full_rendered_inputs_match_without_mutating_retrieval(self):
        data = self.document(["source A: café 风险 🎓 " * 1500, "source B: x " * 500])
        data["cases"][0]["arms"][helper.ARMS[1]] = ["source C: β值 " * 1000]
        original = copy.deepcopy(data)
        with patch.object(
            socket.socket, "connect", side_effect=AssertionError("Network forbidden")
        ):
            result = helper.prepare(data, self.encoding)
        self.assertEqual(data, original)
        row = result["cases"][0]
        self.assertEqual(row["quota_tokens"], 4096)
        for arm, value in row["arms"].items():
            self.assertLessEqual(value["input_tokens"], row["quota_tokens"])
            self.assertGreaterEqual(value["input_tokens"], row["quota_tokens"] - 8)
            self.assertEqual(
                value["input_tokens"],
                len(self.encoding.encode(value["rendered_input"])),
            )
            decoded = json.loads(value["rendered_input"])
            self.assertEqual(decoded["question"], data["cases"][0]["question"])
            self.assertEqual(decoded["retrieval_context"], value["retrieval_context"])
            originals = data["cases"][0]["arms"][arm]
            for index, passage in enumerate(value["retrieval_context"]):
                self.assertTrue(originals[index].startswith(passage))
                if index < len(value["retrieval_context"]) - 1:
                    self.assertEqual(originals[index], passage)

    def test_empty_contexts_are_matched_but_mixed_empty_stops(self):
        data = self.document()
        result = helper.prepare(data, self.encoding)
        inputs = [a["rendered_input"] for a in result["cases"][0]["arms"].values()]
        self.assertEqual(len(set(inputs)), 1)
        data["cases"][0]["arms"][helper.ARMS[0]] = ["Relevant evidence."]
        with self.assertRaises(ValueError):
            helper.prepare(data, self.encoding)

    def test_shortest_arm_sets_quota_and_fixed_overhead_cannot_overflow(self):
        data = self.document(["a fact " * 60])
        data["cases"][0]["arms"][helper.ARMS[0]] = ["another fact " * 1000]
        result = helper.prepare(data, self.encoding)["cases"][0]
        self.assertLess(result["quota_tokens"], 4096)
        self.assertTrue(result["arms"][helper.ARMS[0]]["truncated"])
        data["cases"][0]["question"] = "question " * 8000
        with self.assertRaises(ValueError):
            helper.prepare(data, self.encoding)

    def test_rejects_answers_golden_fields_bad_arms_and_duplicate_ids(self):
        for field in [
            "actual_answer",
            "expected_answer",
            "expected_output",
            "retrieval_context",
        ]:
            data = self.document()
            data["cases"][0][field] = "forbidden after generation"
            with self.subTest(field=field), self.assertRaises(ValueError):
                helper.prepare(data, self.encoding)
        for data in [
            {"results": []},
            {"cases": []},
            {"cases": self.document()["cases"] * 2},
            self.document(["  "]),
        ]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                helper.prepare(data, self.encoding)

    def test_cache_missing_fails_without_network(self):
        with (
            TemporaryDirectory() as directory,
            patch.dict(os.environ, {"TIKTOKEN_CACHE_DIR": directory}),
            patch.object(
                socket.socket,
                "connect",
                side_effect=AssertionError("Network forbidden"),
            ),
        ):
            with self.assertRaises(ValueError):
                helper.offline_encoding()

    def test_cli_writes_private_exclusive_output(self):
        with TemporaryDirectory() as directory:
            source = Path(directory) / "input.json"
            output = Path(directory) / "prepared.json"
            source.write_text(json.dumps(self.document(["Test fact."])))
            command = [
                sys.executable,
                str(SCRIPT),
                "--input",
                str(source),
                "--output",
                str(output),
            ]
            subprocess.run(command, check=True, capture_output=True)
            before = output.read_bytes()
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 2)
            self.assertEqual(output.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
