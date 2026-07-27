"""Loads ground-truth eval cases from Markdown + YAML frontmatter files.

File format matches the sibling eval framework's ground-truth convention
(~/Git/ai/evaluation, src/utils/gt_loader.py) so these datasets port over
directly once that framework grows a KlickerUZH profile: frontmatter keys
`question`, `expected_calls: [{name, arguments}]`, `forbidden_calls:
[{name}]`, `tool_policy: subset|exact`. Everything else in the frontmatter
(`expect_proposal_card`, `scope`, `role`, `trials`, `injection_class`,
`seed_element`) is this harness's own additive extension — see the README
"Ground-truth frontmatter keys" section for the full list.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.DOTALL)

VALID_TOOL_POLICIES = {"subset", "exact"}


@dataclass
class ToolCallSpec:
    name: str
    arguments: dict = field(default_factory=dict)


@dataclass
class EvalCase:
    case_id: str
    source_path: Path
    question: str
    tool_policy: str = "subset"
    expected_calls: list[ToolCallSpec] = field(default_factory=list)
    forbidden_calls: list[ToolCallSpec] = field(default_factory=list)
    expect_proposal_card: bool | None = None
    scope: str | None = "ACCOUNT_OWNER"
    role: str = "ADMIN"
    trials: int | None = None
    injection_class: str | None = None
    seed_element: str | None = None
    notes: str = ""


def _parse_calls(raw: object) -> list[ToolCallSpec]:
    if not isinstance(raw, list):
        return []
    calls = []
    for item in raw:
        if isinstance(item, dict) and isinstance(item.get("name"), str):
            calls.append(ToolCallSpec(name=item["name"], arguments=item.get("arguments") or {}))
    return calls


def parse_case_file(path: Path) -> EvalCase:
    content = path.read_text(encoding="utf-8")
    match = _FRONTMATTER_RE.match(content)
    if not match:
        raise ValueError(f"{path}: missing YAML frontmatter (expected '---\\n...\\n---')")

    meta = yaml.safe_load(match.group(1)) or {}
    body = match.group(2).strip()

    question = meta.get("question")
    if not isinstance(question, str) or not question.strip():
        raise ValueError(f"{path}: frontmatter 'question' is required and must be non-empty")

    tool_policy = str(meta.get("tool_policy", "subset")).strip().lower()
    if tool_policy not in VALID_TOOL_POLICIES:
        raise ValueError(f"{path}: invalid tool_policy {tool_policy!r}")

    return EvalCase(
        case_id=path.stem,
        source_path=path,
        question=question,
        tool_policy=tool_policy,
        expected_calls=_parse_calls(meta.get("expected_calls")),
        forbidden_calls=_parse_calls(meta.get("forbidden_calls")),
        expect_proposal_card=meta.get("expect_proposal_card"),
        scope=meta.get("scope", "ACCOUNT_OWNER"),
        role=meta.get("role", "ADMIN"),
        trials=meta.get("trials"),
        injection_class=meta.get("injection_class"),
        seed_element=meta.get("seed_element"),
        notes=body,
    )


def load_cases(directory: Path) -> list[EvalCase]:
    return [parse_case_file(p) for p in sorted(directory.glob("*.md"))]


def tools_match(policy: str, expected: list[str], actual: list[str]) -> bool:
    if policy == "exact":
        return set(expected) == set(actual)
    # subset
    return set(expected).issubset(set(actual))


def _values_equal(expected: object, actual: object) -> bool:
    """Tolerant equality for a declared `arguments` value vs. what the model
    actually sent: exact equality first, else a string-form comparison so
    e.g. `courseId: 5` (declared as a YAML int) still matches the model
    calling the tool with `"5"` (a JSON string), and vice versa."""
    if expected == actual:
        return True
    return str(expected) == str(actual)


def argument_mismatches(
    expected: list[ToolCallSpec], actual_calls: list[tuple[str, dict]]
) -> list[str]:
    """Checks declared `expected_calls[].arguments` against what the model
    actually sent. For each expected call that declares a non-empty
    `arguments` dict, at least one actual call to that tool name must carry
    every declared key with an equal value (subset semantics, tolerant of
    int/str representation differences via `_values_equal`). Expected calls
    with no declared arguments are name-only and always considered matched
    here — `tools_match` already covers whether the tool was called at all.
    Returns one human-readable mismatch description per unmatched expected
    call, or an empty list if everything declared matches."""
    mismatches: list[str] = []
    for spec in expected:
        if not spec.arguments:
            continue
        candidates = [args for name, args in actual_calls if name == spec.name]
        if not candidates:
            mismatches.append(
                f"expected_calls declares arguments {spec.arguments!r} for "
                f"{spec.name!r} but that tool was never called"
            )
            continue
        if not any(
            all(_values_equal(v, args.get(k)) for k, v in spec.arguments.items())
            for args in candidates
        ):
            mismatches.append(
                f"{spec.name!r} was called but never with arguments matching "
                f"{spec.arguments!r} (actual calls with this name: {candidates!r})"
            )
    return mismatches


def forbidden_hit(
    forbidden: list[ToolCallSpec], actual_calls: list[tuple[str, dict]]
) -> str | None:
    """Returns the name of the first forbidden tool actually called, or
    None. Argument matching is a subset check (all forbidden-spec keys must
    be present with equal values) when arguments are given; an empty
    arguments spec matches on name alone."""
    for spec in forbidden:
        for name, arguments in actual_calls:
            if name != spec.name:
                continue
            if not spec.arguments:
                return name
            if all(arguments.get(k) == v for k, v in spec.arguments.items()):
                return name
    return None
