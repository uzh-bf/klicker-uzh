"""Offline wire qualification; the only allowed provider is a local fake server."""

import copy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
import os
from pathlib import Path
import socket
import sys
from tempfile import TemporaryDirectory
import threading
import unittest
from unittest.mock import patch

import httpx
from openai import InternalServerError, OpenAI

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "evaluation/framework/src"))
os.environ["DEEPEVAL_TELEMETRY_OPT_OUT"] = "YES"

from deepeval.dataset import Golden  # noqa: E402
from utils import utils  # noqa: E402

SCRIPT = ROOT / "evaluation/scripts/prepare-graph-comparison.py"
spec = importlib.util.spec_from_file_location("prepare_graph_comparison", SCRIPT)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class MatchedGenerationContract(unittest.TestCase):
    def setUp(self):
        self.requests = []
        self.fail_on = None
        self.contract = {
            "model": "synthetic-model",
            "system_prompt": "Answer using only the supplied evidence.",
            "reasoning_effort": "low",
            "max_completion_tokens": 256,
        }
        with patch.object(socket.socket, "connect", side_effect=AssertionError):
            self.encoding = helper.offline_encoding()
        self.prepared = helper.prepare(
            {
                "cases": [
                    {
                        "id": "synthetic",
                        "question": "Which fact is supported?",
                        "arms": {
                            arm: [f"Fact {index} supports the topic."]
                            for index, arm in enumerate(helper.ARMS)
                        },
                    }
                ]
            },
            self.encoding,
        )
        test = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                test.requests.append((self.path, body))
                failure = test.fail_on == len(test.requests)
                self.send_response(500 if failure else 200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                payload = (
                    {"error": {"message": "Synthetic failure"}}
                    if failure
                    else {
                        "id": f"fake-{len(test.requests)}",
                        "object": "chat.completion",
                        "created": 0,
                        "model": body["model"],
                        "choices": [
                            {
                                "index": 0,
                                "finish_reason": "stop",
                                "message": {"role": "assistant", "content": "A fact."},
                            }
                        ],
                        "usage": {
                            "prompt_tokens": 42,
                            "completion_tokens": 3,
                            "total_tokens": 45,
                        },
                    }
                )
                self.wfile.write(json.dumps(payload).encode())

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.thread.join)
        self.addCleanup(self.server.shutdown)
        port = self.server.server_address[1]
        real_connect = socket.socket.connect

        def loopback_only(sock, address):
            if address != ("127.0.0.1", port):
                raise AssertionError(f"Non-test network forbidden: {address}")
            return real_connect(sock, address)

        self.guard = patch.object(socket.socket, "connect", loopback_only)
        self.guard.start()
        self.addCleanup(self.guard.stop)
        self.client = OpenAI(
            base_url=f"http://127.0.0.1:{port}/v1",
            api_key="synthetic-offline-key",
            max_retries=2,
            http_client=httpx.Client(trust_env=False),
        )
        self.addCleanup(self.client.close)

    def generate(self, prepared=None, contract=None):
        return helper.generate_matched(
            prepared or self.prepared,
            contract or self.contract,
            self.client,
            self.encoding,
        )

    def test_exact_wire_input_and_native_qa_reference_join(self):
        records = list(self.generate())
        self.assertEqual(len(records), 3)
        for arm, record, (path, body) in zip(helper.ARMS, records, self.requests):
            saved = self.prepared["cases"][0]["arms"][arm]
            self.assertEqual(path, "/v1/chat/completions")
            self.assertEqual(
                body,
                {
                    "model": self.contract["model"],
                    "messages": [
                        {"role": "system", "content": self.contract["system_prompt"]},
                        {"role": "user", "content": saved["rendered_input"]},
                    ],
                    "reasoning_effort": "low",
                    "max_completion_tokens": 256,
                },
            )
            self.assertNotIn("expected_answer", record)
            self.assertEqual(record["retrieval_context"], saved["retrieval_context"])
            self.assertEqual(
                record["source_metadata"]["input_tokens"], saved["input_tokens"]
            )
        golden = Golden(
            input=records[0]["question"],
            expected_output="Private synthetic reference not sent to generation.",
            additional_metadata={"case_id": "synthetic"},
        )
        joined = helper.attach_references(records, [golden])
        with TemporaryDirectory() as directory:
            path = Path(directory) / "qa.json"
            path.write_text(json.dumps({"results": joined}))
            with patch.object(utils, "load_context", return_value=""):
                dataset = utils.create_dataset_from_file(path)
        self.assertEqual(len(dataset.test_cases), 3)
        self.assertEqual({case.input for case in dataset.test_cases}, {golden.input})
        self.assertEqual(
            {case.expected_output for case in dataset.test_cases},
            {golden.expected_output},
        )
        self.assertNotIn(golden.expected_output, json.dumps(self.requests))
        for case, record in zip(dataset.test_cases, joined):
            self.assertEqual(case.retrieval_context, record["retrieval_context"])
        wrong = golden.model_copy(update={"input": "A different question"})
        with self.assertRaises(ValueError):
            helper.attach_references(records, [wrong])

    def test_preflights_all_arms_before_any_request(self):
        mutations = [
            ("input_sha256", "0" * 64),
            ("input_tokens", 1),
            ("retrieval_context", ["Tampered passage"]),
            ("rendered_input", '{"question":"different","retrieval_context":[]}'),
        ]
        for field, value in mutations:
            prepared = copy.deepcopy(self.prepared)
            prepared["cases"][0]["arms"][helper.ARMS[-1]][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                list(self.generate(prepared=prepared))
        prepared = copy.deepcopy(self.prepared)
        prepared["expected_output"] = "Must not leak"
        with self.assertRaises(ValueError):
            list(self.generate(prepared=prepared))
        contract = {**self.contract, "max_completion_tokens": True}
        with self.assertRaises(ValueError):
            list(self.generate(contract=contract))
        self.assertEqual(self.requests, [])

    def test_failure_stops_without_retry_and_preserves_first_response(self):
        self.fail_on = 2
        iterator = self.generate()
        first = next(iterator)
        with self.assertRaises(InternalServerError):
            next(iterator)
        self.assertEqual(first["source_metadata"]["arm"], helper.ARMS[0])
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(list(iterator), [])


if __name__ == "__main__":
    unittest.main()
