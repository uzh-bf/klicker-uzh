"""Optional offline importer for Klicker's sanitized trajectory receipts."""

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from uuid import UUID

FORMAT = "conversation_capture"
GROUPS = {"development", "reserved", "control"}
MODES = {"tutor", "explainer", "quizzer"}
CASE_FIELDS = {
    "id",
    "group",
    "language",
    "mode",
    "support",
    "rubric",
    "assessmentTurns",
    "turns",
}
ERROR_FIELDS = {"type", "arm", "caseId", "turn", "repeat", "code", "recordedAt"}
TURN_FIELDS = {
    "type",
    "receiptVersion",
    "arm",
    "caseId",
    "group",
    "language",
    "mode",
    "support",
    "repeat",
    "turn",
    "threadId",
    "userMessageId",
    "assistantMessageId",
    "parentId",
    "model",
    "userText",
    "assistantText",
    "sources",
    "sourceMapping",
    "toolName",
    "toolStatus",
    "latencyMs",
    "creditsUsed",
    "recordedAt",
}
SOURCE_FIELDS = {
    "toolCallId",
    "sourcePosition",
    "citationIndex",
    "identityHash",
    "type",
    "page",
    "startSec",
    "endSec",
}


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _integer(value: object, minimum: int = 0) -> bool:
    return type(value) is int and value >= minimum


def _integral(value: object) -> bool:
    """Match Number.isInteger on JSON-parsed numbers, excluding booleans."""
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    return isinstance(value, float) and value.is_integer()


def _text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _uuid(value: object) -> UUID:
    _require(isinstance(value, str), "Invalid message or thread UUID")
    try:
        return UUID(value)
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError("Invalid message or thread UUID") from exc


def _number(value: object) -> bool:
    return (
        type(value) in (int, float) and (type(value) is int or math.isfinite(value)) and value >= 0
    )


def _hash(value: object) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def _validate_corpus(corpus: object, group: str | None) -> list[dict]:
    _require(group is None or group in GROUPS, "Invalid corpus group")
    _require(
        isinstance(corpus, dict) and set(corpus) == {"version", "cases"},
        "Invalid corpus fields",
    )
    version = corpus["version"]
    _require(_integral(version) and version == 1, "Invalid corpus version")
    cases = corpus["cases"]
    _require(isinstance(cases, list) and bool(cases), "Missing corpus cases")
    seen = set()
    for case in cases:
        _require(isinstance(case, dict) and set(case) == CASE_FIELDS, "Invalid corpus case fields")
        _require(_text(case.get("id")) and case["id"] not in seen, "Duplicate or invalid case ID")
        seen.add(case["id"])
        _require(
            isinstance(case.get("group"), str) and case.get("group") in GROUPS,
            "Invalid case group",
        )
        _require(
            isinstance(case.get("language"), str)
            and case.get("language") in {"en", "de"}
            and isinstance(case.get("mode"), str)
            and case.get("mode") in MODES,
            "Invalid language or mode",
        )
        _require(_text(case.get("support")), "Missing case support")
        rubric = case.get("rubric")
        _require(
            isinstance(rubric, list) and bool(rubric) and all(map(_text, rubric)), "Invalid rubric"
        )
        turns = case.get("turns")
        _require(isinstance(turns, list) and bool(turns), "Missing case turns")
        for index, turn in enumerate(turns):
            _require(isinstance(turn, dict), "Invalid corpus turn")
            literal = set(turn) == {"message"} and _text(turn.get("message"))
            repeat = (
                set(turn) == {"repeatPrevious", "suffix"}
                and index > 0
                and turn.get("repeatPrevious") is True
                and isinstance(turn.get("suffix"), str)
            )
            _require(literal or repeat, "Invalid corpus turn")
        assessment = case.get("assessmentTurns")
        _require(isinstance(assessment, list) and bool(assessment), "Invalid assessment turns")
        seen_assessments = set()
        for selection in assessment:
            _require(
                _integral(selection)
                and 1 <= selection <= len(turns)
                and selection not in seen_assessments,
                "Invalid assessment turns",
            )
            seen_assessments.add(selection)
    selected = [case for case in cases if group is None or case["group"] == group]
    _require(bool(selected), "Corpus selection is empty")
    return selected


def _validate_sources(receipt: dict) -> None:
    mapping = receipt.get("sourceMapping")
    _require(
        isinstance(mapping, dict) and set(mapping) == {"version", "maxSources", "fingerprint"},
        "Invalid source mapping",
    )
    _require(
        _integral(mapping["version"])
        and mapping["version"] == 1
        and _integer(mapping["maxSources"], 1)
        and _hash(mapping["fingerprint"]),
        "Invalid source mapping provenance",
    )
    sources = receipt.get("sources")
    _require(isinstance(sources, list), "Invalid sources")
    for source in sources:
        _require(isinstance(source, dict) and set(source) == SOURCE_FIELDS, "Invalid source fields")
        _require(
            _text(source["toolCallId"]) and _integer(source["sourcePosition"], 1),
            "Invalid source position",
        )
        citation = source["citationIndex"]
        _require(
            citation is None or (_integer(citation, 1) and citation <= mapping["maxSources"]),
            "Invalid citation index",
        )
        _require(
            source["identityHash"] is None or _hash(source["identityHash"]),
            "Invalid source identity",
        )
        _require(source["type"] is None or isinstance(source["type"], str), "Invalid source type")
        for field in ("page", "startSec", "endSec"):
            _require(source[field] is None or _number(source[field]), "Invalid source location")


def import_trajectories(
    receipts_path: Path,
    corpus_path: Path,
    group: str | None = None,
) -> dict:
    corpus_bytes = corpus_path.read_bytes()
    cases = _validate_corpus(json.loads(corpus_bytes), group)
    lines = receipts_path.read_text(encoding="utf-8").splitlines()
    _require(bool(lines) and all(line.strip() for line in lines), "Empty or blank receipt line")
    records = [json.loads(line) for line in lines]
    _require(all(isinstance(record, dict) for record in records), "Receipt must be an object")
    summary = records[-1]
    _require(
        summary.get("type") == "summary"
        and all(record.get("type") != "summary" for record in records[:-1]),
        "Exactly one final summary is required",
    )
    _require(summary.get("status") in ("completed", "stopped"), "Invalid summary status")
    _require(_text(summary.get("arm")) and _text(summary.get("model")), "Missing arm or model")
    repeats = summary.get("repeats")
    _require(
        _integer(repeats, 1)
        and _integral(summary.get("cases"))
        and summary.get("cases") == len(cases),
        "Plan count mismatch",
    )
    for field in ("completedTurns", "runSubmittedTurns", "submittedTurns"):
        _require(_integer(summary.get(field)), "Invalid summary counters")
    completed = summary["completedTurns"]
    submitted = summary["runSubmittedTurns"]
    _require(
        completed <= submitted <= completed + 1 and summary["submittedTurns"] >= submitted,
        "Invalid local submission counters",
    )
    errors = [record for record in records[:-1] if record.get("type") == "error"]
    stopped = summary["status"] == "stopped"
    _require(len(errors) == int(stopped), "Stopped summary requires one error")
    error = errors[0] if errors else None
    if error:
        _require(set(error) == ERROR_FIELDS, "Invalid error receipt fields")
        _require(
            records[-2] is error
            and _text(error.get("code"))
            and error.get("code") == summary.get("stopCode")
            and error.get("arm") == summary["arm"],
            "Invalid stopped error",
        )
        _require(
            error["turn"] is None or (_integral(error["turn"]) and error["turn"] >= 1),
            "Invalid error turn",
        )
    else:
        _require(summary.get("stopCode") is None, "Completed summary cannot have stop code")

    planned = [(case, repeat) for case in cases for repeat in range(repeats)]
    by_key = {(case["id"], repeat): [] for case, repeat in planned}
    order = {key: index for index, key in enumerate(by_key)}
    if error:
        error_key = (error.get("caseId"), error.get("repeat"))
        _require(
            error_key == (None, None)
            or (_text(error["caseId"]) and _integral(error["repeat"]) and error_key in by_key),
            "Invalid error trajectory",
        )

    message_ids = set()
    threads = {}
    previous_order = -1
    mapping_provenance = None
    for receipt in records[:-1]:
        if receipt.get("type") == "error":
            continue
        _require(
            set(receipt) == TURN_FIELDS
            and receipt.get("type") == "turn"
            and receipt.get("receiptVersion") == 2,
            "Unsupported turn receipt",
        )
        key = (receipt["caseId"], receipt["repeat"])
        _require(
            _text(receipt["caseId"]) and _integer(receipt["repeat"]) and key in by_key,
            "Unknown trajectory",
        )
        index = order[key]
        _require(index >= previous_order, "Trajectory order mismatch")
        previous_order = index
        case = planned[index][0]
        captured = by_key[key]
        turn_number = len(captured) + 1
        _require(
            _integral(receipt["turn"])
            and receipt["turn"] == turn_number
            and turn_number <= len(case["turns"]),
            "Non-contiguous trajectory turns",
        )
        for field in ("group", "language", "mode", "support"):
            _require(receipt[field] == case[field], "Corpus identity mismatch")
        _require(
            receipt["arm"] == summary["arm"] and receipt["model"] == summary["model"],
            "Arm or model mismatch",
        )
        expected = case["turns"][turn_number - 1]
        learner_text = (
            expected["message"]
            if "message" in expected
            else captured[-1]["assistantText"] + expected["suffix"]
        )
        _require(
            receipt["userText"] == learner_text and _text(receipt["assistantText"]),
            "Corpus learner text mismatch or empty answer",
        )
        identifiers = {
            field: _uuid(receipt[field])
            for field in ("threadId", "userMessageId", "assistantMessageId")
        }
        for field in ("userMessageId", "assistantMessageId"):
            _require(identifiers[field] not in message_ids, "Duplicate message UUID")
            message_ids.add(identifiers[field])
        thread = identifiers["threadId"]
        _require(
            thread not in threads or threads[thread] == key, "Thread reused across trajectories"
        )
        threads[thread] = key
        if captured:
            _require(thread == _uuid(captured[0]["threadId"]), "Trajectory thread changed")
        parent = captured[-1]["assistantMessageId"] if captured else None
        _require(receipt["parentId"] == parent, "Parent ancestry mismatch")
        _require(
            _number(receipt["latencyMs"])
            and (receipt["creditsUsed"] is None or _number(receipt["creditsUsed"])),
            "Invalid turn accounting",
        )
        _require(
            (receipt["toolName"], receipt["toolStatus"])
            in (("KB_doc_query", "completed"), (None, "not_called")),
            "Invalid retrieval status",
        )
        _require(
            turn_number != 1 or receipt["toolName"] == "KB_doc_query",
            "First turn requires grounded retrieval",
        )
        _validate_sources(receipt)
        if mapping_provenance is None:
            mapping_provenance = receipt["sourceMapping"]
        _require(receipt["sourceMapping"] == mapping_provenance, "Source mapper changed during run")
        captured.append(receipt)

    _require(sum(map(len, by_key.values())) == completed, "Completed counter mismatch")
    planned_turns = sum(len(case["turns"]) for case, _ in planned)
    if not stopped:
        _require(completed == submitted == planned_turns, "Completed run has missing turns")
    else:
        # Serial execution cannot produce later captures after a partial trajectory.
        incomplete = False
        for case, repeat in planned:
            captured = by_key[(case["id"], repeat)]
            _require(
                not incomplete or not captured, "Capture continued after an incomplete trajectory"
            )
            incomplete |= len(captured) < len(case["turns"])

    results = []
    for case, repeat in planned:
        captured = by_key[(case["id"], repeat)]
        complete = len(captured) == len(case["turns"])
        eligible = complete and case["mode"] in {"tutor", "explainer"}
        turns = []
        for receipt in captured:
            turns.extend(
                [
                    {"role": "user", "content": receipt["userText"]},
                    {"role": "assistant", "content": receipt["assistantText"], "metadata": receipt},
                ]
            )
        disposition = (
            "capture_incomplete" if not complete else "eligible" if eligible else "unsupported_mode"
        )
        results.append(
            {
                "id": f"{case['id']}:{repeat}",
                "thread_id": captured[0]["threadId"] if captured else None,
                "chat_mode": case["mode"],
                "success": eligible,
                "assessment_eligible": eligible,
                "capture_status": "complete"
                if complete
                else "incomplete"
                if captured
                else "not_started",
                "assessment_disposition": disposition,
                "turns": turns,
                "scenario": case["turns"][0]["message"],
                "expected_outcome": "\n".join(case["rubric"]),
                "capture": {
                    "case_id": case["id"],
                    "repeat": repeat,
                    "arm": summary["arm"],
                    "group": case["group"],
                    "language": case["language"],
                    "mode": case["mode"],
                    "support": case["support"],
                    "assessment_turns": sorted(int(n) for n in case["assessmentTurns"]),
                    "error": error
                    if error and (error.get("caseId"), error.get("repeat")) == (case["id"], repeat)
                    else None,
                },
            }
        )
    return {
        "metadata": {
            "format": FORMAT,
            "preserve_capture_records": True,
            "summary": summary,
            "corpus_sha256": hashlib.sha256(corpus_bytes).hexdigest(),
            "corpus_identity": "caller_attested",
            "group": group,
            "source_evidence": "mapping_diagnostics_only",
        },
        "results": results,
    }


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipts", type=Path)
    parser.add_argument("--corpus", required=True, type=Path)
    parser.add_argument("--group", choices=sorted(GROUPS))
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    artifact = import_trajectories(args.receipts, args.corpus, args.group)
    with args.output.open("x", encoding="utf-8") as stream:
        json.dump(artifact, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


if __name__ == "__main__":
    main()
