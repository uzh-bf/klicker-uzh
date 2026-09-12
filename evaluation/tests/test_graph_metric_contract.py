"""Offline integration contract for the optional, pinned evaluation submodule.

Run with that framework's Python environment. Judges are replaced; this proves
context consumption and metric selection, never retrieval or answer quality.
"""

import json
import os
from pathlib import Path
import socket
import sys
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[2]
FRAMEWORK = ROOT / "evaluation" / "framework"
if not (FRAMEWORK / "src" / "evaluators" / "run_evaluation.py").is_file():
    raise RuntimeError("Initialize the optional evaluation framework before this check")
sys.path.insert(0, str(FRAMEWORK / "src"))

# Explicit fake configuration prevents fallback to locally configured credentials.
os.environ.update(
    {
        "DEEPEVAL_TELEMETRY_OPT_OUT": "YES",
        "LITELLM_API_KEY": "synthetic-offline-key",
        "OPENAI_API_KEY": "synthetic-offline-key",
        "LITELLM_API_BASE": "http://127.0.0.1:1",
        "EVAL_MODEL": "offline-contract-judge",
        "EVAL_REASONING_EFFORT": "low",
        "EVAL_METRICS_PATH": str(
            ROOT / "evaluation/data/metrics/klicker_graph_retrieval.yaml"
        ),
    }
)

from deepeval.models import DeepEvalBaseLLM
from customization import custom_metrics
from evaluators import run_evaluation
from utils import utils


class OfflineJudge(DeepEvalBaseLLM):
    def load_model(self):
        return self

    def generate(self, *args, **kwargs):
        raise AssertionError("Offline contract must never invoke a judge")

    async def a_generate(self, *args, **kwargs):
        raise AssertionError("Offline contract must never invoke a judge")

    def get_model_name(self):
        return "offline-contract-judge"


class GraphMetricContract(unittest.TestCase):
    def test_framework_consumes_context_and_accounts_for_missing_evidence(self):
        passages = ["synthetic passage B", "synthetic passage A", "synthetic passage B"]
        records = [
            {
                "id": "complete",
                "question": "question one",
                "actual_answer": "answer one",
                "expected_answer": "reference one",
                "success": True,
                "retrieval_context": [],
            },
            {
                "id": "empty",
                "question": "question two",
                "actual_answer": "abstention",
                "expected_answer": "abstention",
                "success": True,
                "retrieval_context": [],
            },
            {
                "id": "missing",
                "question": "question three",
                "actual_answer": "answer three",
                "expected_answer": "reference three",
                "success": True,
            },
            {
                "id": "failed",
                "question": "question four",
                "actual_answer": "",
                "expected_answer": "reference four",
                "success": False,
            },
        ]
        observed = []

        def evaluate_offline(*, test_cases, metrics, **kwargs):
            case = test_cases[0]
            names = [custom_metrics.runtime_metric_name(metric) for metric in metrics]
            observed.append((case, names))
            # Stub outcomes exercise the existing runner's accounting only.
            return SimpleNamespace(
                test_results=[
                    SimpleNamespace(
                        success=True,
                        metrics_data=[
                            SimpleNamespace(
                                name=name,
                                score=1.0,
                                success=True,
                                threshold=metric.threshold,
                                reason="offline contract substitute",
                                evaluation_cost=0.0,
                                error=None,
                            )
                            for name, metric in zip(names, metrics)
                        ],
                    )
                ]
            )

        with TemporaryDirectory() as directory:
            qa_path = Path(directory) / "qa.json"
            qa_path.write_text(
                json.dumps({"metadata": {"agent_id": "synthetic"}, "results": records})
            )
            capture_script = """
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const { evaluatePersistedEvidence, writeEvidenceCapture } = await import(
  pathToFileURL(resolve('apps/chat/scripts/klicker-evaluation-evidence.mjs')))
const qa = JSON.parse(await readFile(process.argv[1], 'utf8'))
for (const row of qa.results.filter(row => row.success)) {
  const sources = row.id === 'complete'
    ? [{ chunks: JSON.parse(process.argv[3]).map(content => ({ content })) }]
    : []
  const content = row.id === 'missing' ? [] : [{type: 'tool-call',
    toolName: 'KB_doc_query', result: {mode: 'documents', sources}}]
  await writeEvidenceCapture({directory: process.argv[2], capture: evaluatePersistedEvidence({
    responseId: row.id, runId: 'offline-run', question: row.question,
    answer: row.actual_answer, mode: 'explainer', requestedModel: 'synthetic',
    persistedModel: 'synthetic', content})})
}
"""
            for row in records:
                row["chat_mode"] = "explainer"
            qa_path.write_text(
                json.dumps({"metadata": {"agent_id": "synthetic"}, "results": records})
            )
            evidence_dir = Path(directory) / "evidence"
            subprocess.run(
                [
                    "node",
                    "--input-type=module",
                    "-e",
                    capture_script,
                    str(qa_path),
                    str(evidence_dir),
                    json.dumps(passages),
                ],
                cwd=ROOT,
                check=True,
            )
            enriched_path = Path(directory) / "enriched.json"
            enrichment = subprocess.run(
                [
                    "node",
                    "evaluation/scripts/enrich-chat-qa.mjs",
                    "--qa-file",
                    str(qa_path),
                    "--evidence-dir",
                    str(evidence_dir),
                    "--output",
                    str(enriched_path),
                    "--run-id",
                    "offline-run",
                    "--model",
                    "synthetic",
                ],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
            )
            receipt = json.loads(enrichment.stdout)
            self.assertEqual(receipt["context_complete"], 1)
            self.assertEqual(receipt["context_empty"], 1)
            self.assertEqual(receipt["context_no_calls"], 1)
            with (
                patch.object(
                    socket.socket,
                    "connect",
                    side_effect=AssertionError("Network forbidden"),
                ),
                patch.object(utils, "load_context", return_value=""),
                patch.object(run_evaluation, "OUTPUT_DIR", Path(directory)),
                patch.object(
                    run_evaluation, "create_eval_model", return_value=OfflineJudge()
                ),
                patch.object(run_evaluation, "evaluate", side_effect=evaluate_offline),
            ):
                result = run_evaluation.run_evaluation(
                    qa_files=[str(enriched_path)], eval_mode="ground-truth"
                )

        self.assertEqual(len(observed), 3)
        self.assertEqual(observed[0][0].retrieval_context, passages)
        self.assertEqual(
            set(observed[0][1]),
            {
                "Semantic Similarity [GEval]",
                "Contextual Precision",
                "Contextual Recall",
                "Faithfulness",
            },
        )
        for case, names in observed[1:]:
            self.assertFalse(case.retrieval_context)
            self.assertEqual(names, ["Semantic Similarity [GEval]"])
        counts = result["metadata"]["count"]
        self.assertEqual(counts["total"], 4)
        self.assertEqual(counts["skipped"], 1)
        self.assertEqual(counts["judge_errors"], 0)
        self.assertEqual(len(result["results"]), 3)
        # This pin's primary gate requires tool correctness too; do not report it as passed.
        self.assertEqual(counts["primary_evaluated"], 0)
        self.assertEqual(
            result["results"][0]["metrics"]["Semantic Similarity [GEval]"]["threshold"],
            0.5,
        )


if __name__ == "__main__":
    unittest.main()
