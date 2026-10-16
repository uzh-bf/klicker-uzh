"""Prepare three matched retrieval inputs offline; DeepEval owns quality scoring.

Input: {"cases": [{"id": "...", "question": "...", "arms": {
"ordinary-rag": ["passage"], "document-second-search": ["passage"],
"falkordb-graphrag": ["passage"]}}]}. No answer or golden fields are accepted.
"""

import argparse
import copy
import hashlib
from importlib.metadata import version
import json
import os
from pathlib import Path
import tempfile
from unittest.mock import patch

ARMS = ("ordinary-rag", "document-second-search", "falkordb-graphrag")
INPUT_CAP = 4096
TOLERANCE = 8


def offline_encoding():
    import tiktoken
    from tiktoken import load
    from tiktoken_ext import openai_public

    def cached_only(blobpath, expected_hash=None):
        cache_dir = os.environ.get(
            "TIKTOKEN_CACHE_DIR",
            os.environ.get(
                "DATA_GYM_CACHE_DIR",
                str(Path(tempfile.gettempdir()) / "data-gym-cache"),
            ),
        )
        if not cache_dir:
            raise ValueError("Offline tokenizer cache is disabled")
        cache_file = Path(cache_dir) / hashlib.sha1(blobpath.encode()).hexdigest()
        if not cache_file.is_file():
            raise ValueError("Offline o200k_base tokenizer cache is unavailable")
        data = cache_file.read_bytes()
        if expected_hash and hashlib.sha256(data).hexdigest() != expected_hash:
            raise ValueError("Offline tokenizer cache failed integrity validation")
        return data

    # Construct explicitly so a prior process-global cache cannot hide a missing file.
    with patch.object(load, "read_file_cached", side_effect=cached_only):
        return tiktoken.Encoding(**openai_public.o200k_base())


def render(question, passages):
    return json.dumps(
        {"question": question, "retrieval_context": passages},
        ensure_ascii=False,
        separators=(",", ":"),
    )


def prefix(passages, characters):
    selected = []
    for passage in passages:
        if characters <= 0:
            break
        selected.append(passage[:characters])
        characters -= len(passage)
    return selected


def prepare(document, encoding):
    if not isinstance(document, dict) or set(document) != {"cases"}:
        raise ValueError(
            "Input must contain only cases; QA and golden files are not accepted"
        )
    cases = document["cases"]
    if not isinstance(cases, list) or not 1 <= len(cases) <= 200:
        raise ValueError("Expected between 1 and 200 cases")
    result = []
    ids = set()

    def count(text):
        return len(encoding.encode(text, disallowed_special=()))

    for case in cases:
        if not isinstance(case, dict) or set(case) != {"id", "question", "arms"}:
            raise ValueError(
                "Cases accept only id, question and arms before generation"
            )
        case_id, question, arms = case["id"], case["question"], case["arms"]
        if not isinstance(case_id, str) or not case_id.strip() or case_id in ids:
            raise ValueError("Case IDs must be unique nonempty strings")
        ids.add(case_id)
        if not isinstance(question, str) or not question.strip():
            raise ValueError("Question must be nonempty")
        if not isinstance(arms, dict) or set(arms) != set(ARMS):
            raise ValueError("Each case requires the three named comparison arms")
        for passages in arms.values():
            if not isinstance(passages, list) or any(
                not isinstance(p, str) or not p.strip() for p in passages
            ):
                raise ValueError(
                    "Each arm requires an ordered list of nonempty passages"
                )
        if any(bool(p) for p in arms.values()) and not all(
            bool(p) for p in arms.values()
        ):
            raise ValueError(
                "Mixed empty contexts cannot be matched; retain as retrieval failures"
            )
        if count(render(question, [])) > INPUT_CAP:
            raise ValueError(
                "Question and fixed renderer overhead exceed the input cap"
            )
        quota = min(INPUT_CAP, *(count(render(question, arms[arm])) for arm in ARMS))
        prepared = {}
        for arm in ARMS:
            passages = arms[arm]
            selected = passages
            if count(render(question, passages)) > quota:
                low, high = 0, sum(map(len, passages))
                selected = []
                while low <= high:
                    middle = (low + high) // 2
                    candidate = prefix(passages, middle)
                    if count(render(question, candidate)) <= quota:
                        selected = candidate
                        low = middle + 1
                    else:
                        high = middle - 1
            rendered = render(question, selected)
            actual = count(rendered)
            if not quota - TOLERANCE <= actual <= quota:
                raise ValueError(
                    "No matched Unicode prefix found within the token tolerance"
                )
            prepared[arm] = {
                "retrieval_context": selected,
                "rendered_input": rendered,
                "input_sha256": hashlib.sha256(rendered.encode()).hexdigest(),
                "input_tokens": actual,
                "original_input_tokens": count(render(question, passages)),
                "truncated": selected != passages,
            }
        result.append({"id": case_id, "quota_tokens": quota, "arms": prepared})
    return {
        "schema_version": 1,
        "encoding": "o200k_base",
        "tiktoken_version": version("tiktoken"),
        "input_cap_tokens": INPUT_CAP,
        "tolerance_tokens": TOLERANCE,
        "generation_contract": "Use rendered_input unchanged; same system prompt, model, effort and output cap across arms",
        "cases": result,
    }


def validate_generation(prepared, contract, encoding):
    """Validate every saved input before a caller can dispatch the first arm."""
    if not isinstance(contract, dict) or set(contract) != {
        "model",
        "system_prompt",
        "reasoning_effort",
        "max_completion_tokens",
    }:
        raise ValueError("Freeze model, system prompt, effort and output cap")
    if any(
        not isinstance(contract[key], str) or not contract[key].strip()
        for key in ("model", "system_prompt", "reasoning_effort")
    ) or (
        type(contract["max_completion_tokens"]) is not int
        or not 1 <= contract["max_completion_tokens"] <= 32768
    ):
        raise ValueError("Invalid generation contract")
    if set(prepared) - {
        "schema_version",
        "encoding",
        "tiktoken_version",
        "input_cap_tokens",
        "tolerance_tokens",
        "generation_contract",
        "source_sha256",
        "cases",
    }:
        raise ValueError("Prepared inputs contain unexpected fields")
    if (
        prepared.get("schema_version") != 1
        or prepared.get("encoding") != "o200k_base"
        or prepared.get("tiktoken_version") != version("tiktoken")
        or prepared.get("input_cap_tokens") != INPUT_CAP
        or prepared.get("tolerance_tokens") != TOLERANCE
    ):
        raise ValueError("Prepared tokenizer or token policy does not match")
    cases = prepared.get("cases")
    if not isinstance(cases, list) or not 1 <= len(cases) <= 200:
        raise ValueError("Invalid prepared case set")
    ids = set()
    for case in cases:
        if set(case) != {"id", "quota_tokens", "arms"}:
            raise ValueError("Prepared cases accept only id, quota and arms")
        case_id, quota, arms = case["id"], case["quota_tokens"], case["arms"]
        if not isinstance(case_id, str) or not case_id.strip() or case_id in ids:
            raise ValueError("Invalid or duplicate prepared case ID")
        ids.add(case_id)
        if type(quota) is not int or not 1 <= quota <= INPUT_CAP:
            raise ValueError("Invalid prepared quota")
        if not isinstance(arms, dict) or set(arms) != set(ARMS):
            raise ValueError("Prepared case requires all three comparison arms")
        questions, original_counts = set(), []
        for arm in ARMS:
            value = arms[arm]
            if set(value) != {
                "retrieval_context",
                "rendered_input",
                "input_sha256",
                "input_tokens",
                "original_input_tokens",
                "truncated",
            }:
                raise ValueError("Invalid prepared arm fields")
            passages, rendered = value["retrieval_context"], value["rendered_input"]
            if not isinstance(passages, list) or any(
                not isinstance(p, str) or not p.strip() for p in passages
            ):
                raise ValueError("Invalid ordered prepared passages")
            decoded = json.loads(rendered)
            if set(decoded) != {"question", "retrieval_context"}:
                raise ValueError("Generation input contains extra fields")
            question = decoded["question"]
            if not isinstance(question, str) or not question.strip():
                raise ValueError("Invalid prepared question")
            questions.add(question)
            actual = len(encoding.encode(rendered, disallowed_special=()))
            original = value["original_input_tokens"]
            if (
                rendered != render(question, passages)
                or value["input_sha256"]
                != hashlib.sha256(rendered.encode()).hexdigest()
                or type(value["input_tokens"]) is not int
                or value["input_tokens"] != actual
                or not quota - TOLERANCE <= actual <= quota
                or type(original) is not int
                or original < actual
                or type(value["truncated"]) is not bool
                or (not value["truncated"] and original != actual)
            ):
                raise ValueError("Prepared input failed integrity or quota validation")
            original_counts.append(original)
        if len(questions) != 1 or quota != min(INPUT_CAP, *original_counts):
            raise ValueError("Prepared arms do not share their question and quota")
        if any(bool(a["retrieval_context"]) for a in arms.values()) and not all(
            bool(a["retrieval_context"]) for a in arms.values()
        ):
            raise ValueError("Mixed empty contexts cannot be matched")


def generate_matched(prepared, contract, client, encoding):
    """Yield reference-free QA records using an explicitly caller-owned client.

    Persist each yielded record before requesting the next. Exceptions stop the
    sequence; admitting provider requests and their costs belongs to the caller.
    """
    prepared = copy.deepcopy(prepared)
    contract = dict(contract)
    validate_generation(prepared, contract, encoding)
    contract_hash = hashlib.sha256(
        json.dumps(contract, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()
    single_attempt = client.with_options(max_retries=0, timeout=90)
    for case in prepared["cases"]:
        for arm in ARMS:
            saved = case["arms"][arm]
            response = single_attempt.chat.completions.create(
                model=contract["model"],
                messages=[
                    {"role": "system", "content": contract["system_prompt"]},
                    {"role": "user", "content": saved["rendered_input"]},
                ],
                reasoning_effort=contract["reasoning_effort"],
                max_completion_tokens=contract["max_completion_tokens"],
            )
            if len(response.choices) != 1:
                raise ValueError("Expected one complete answer")
            choice = response.choices[0]
            if (
                choice.finish_reason != "stop"
                or not isinstance(choice.message.content, str)
                or not choice.message.content.strip()
            ):
                raise ValueError("Generation did not produce a complete answer")
            yield {
                "id": f"{case['id']}::{arm}",
                "question": json.loads(saved["rendered_input"])["question"],
                "actual_answer": choice.message.content,
                "success": True,
                "retrieval_context": list(saved["retrieval_context"]),
                "source_metadata": {
                    "case_id": case["id"],
                    "arm": arm,
                    "rendered_input": saved["rendered_input"],
                    "input_sha256": saved["input_sha256"],
                    "input_tokens": saved["input_tokens"],
                    "generation_contract": dict(contract),
                    "generation_contract_sha256": contract_hash,
                    "response_id": response.id,
                    "response_model": response.model,
                    "usage": response.usage.model_dump() if response.usage else None,
                },
            }


def attach_references(records, goldens):
    """Join native DeepEval goldens after generation using stable case IDs."""
    references = {}
    for golden in goldens:
        case_id = (golden.additional_metadata or {}).get("case_id")
        if not case_id or case_id in references or not golden.expected_output:
            raise ValueError("Goldens require unique case IDs and expected outputs")
        references[case_id] = golden
    result = []
    for record in records:
        golden = references.get(record["source_metadata"]["case_id"])
        if golden is None or golden.input != record["question"]:
            raise ValueError("Reference does not match the generated case")
        result.append({**record, "expected_answer": golden.expected_output})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output already exists; preserve earlier preparation")
    try:
        if args.input.stat().st_size > 10 * 1024 * 1024:
            raise ValueError("Input exceeds the 10 MiB preparation limit")
        source = args.input.read_bytes()
        document = json.loads(source.decode("utf-8"))
        prepared = prepare(document, offline_encoding())
        prepared["source_sha256"] = hashlib.sha256(source).hexdigest()
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(prepared, output, ensure_ascii=False, indent=2)
            output.write("\n")
    except (ValueError, OSError, ImportError, UnicodeError) as error:
        parser.exit(2, f"Preparation stopped: {error}\n")


if __name__ == "__main__":
    main()
