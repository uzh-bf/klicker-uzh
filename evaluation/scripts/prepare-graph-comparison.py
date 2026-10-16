"""Prepare three matched retrieval inputs offline; DeepEval owns quality scoring.

Input: {"cases": [{"id": "...", "question": "...", "arms": {
"ordinary-rag": ["passage"], "document-second-search": ["passage"],
"falkordb-graphrag": ["passage"]}}]}. No answer or golden fields are accepted.
"""

import argparse
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
