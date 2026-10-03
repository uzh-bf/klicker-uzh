"""Shared helpers: ground-truth loading, model-name normalisation, prices."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

ROUTING_DIR = Path(__file__).resolve().parents[2]
DEFAULT_GT_DIR = ROUTING_DIR.parent / "data" / "ground_truth" / "klicker_fineco"
DEFAULT_PRICES = ROUTING_DIR / "prices.yaml"
EFFORTS = ("minimal", "low", "medium", "high", "xhigh")
TIERS = ("SIMPLE", "MEDIUM", "COMPLEX", "REASONING")


@dataclass(frozen=True)
class Question:
    id: str
    text: str
    reference: str


def load_questions(gt_dir: Path) -> list[Question]:
    """Read `gt_*.md` files: YAML frontmatter `question`, body is the reference."""
    out = []
    for path in sorted(Path(gt_dir).glob("gt_*.md")):
        raw = path.read_text()
        if not raw.startswith("---"):
            continue
        _, front, body = raw.split("---", 2)
        meta = yaml.safe_load(front) or {}
        if meta.get("question"):
            out.append(Question(path.stem, str(meta["question"]).strip(), body.strip()))
    if not out:
        raise SystemExit(f"no gt_*.md questions with frontmatter found in {gt_dir}")
    return out


def split_alias(name: str) -> tuple[str, str | None]:
    """`klickeruzh/azure/gpt-6.1-sol-medium` -> (`gpt-6.1-sol`, `medium`)."""
    base = name.rsplit("/", 1)[-1]
    m = re.fullmatch(rf"(.+?)-({'|'.join(EFFORTS)})", base)
    return (m.group(1), m.group(2)) if m else (base, None)


def load_prices(path: Path = DEFAULT_PRICES) -> dict[str, dict[str, float]]:
    return yaml.safe_load(Path(path).read_text())


def cost_usd(
    prices: dict, model: str, prompt: int, completion: int, cached: int = 0
) -> float | None:
    """Upstream list cost of one request; None when the model has no price."""
    p = prices.get(split_alias(model)[0])
    if p is None:
        return None
    uncached = max(prompt - cached, 0)
    return (
        uncached * p["input"]
        + cached * p.get("cached_input", p["input"])
        + completion * p["output"]
    ) / 1e6


def read_jsonl(paths: list[Path]) -> list[dict]:
    rows = []
    for path in paths:
        for line in Path(path).read_text().splitlines():
            if line.strip():
                rows.append(json.loads(line))
    return rows


def percentile(values: list[float], q: float) -> float | None:
    """Nearest-rank percentile; None for an empty list."""
    if not values:
        return None
    s = sorted(values)
    return s[min(len(s) - 1, max(0, round(q / 100 * len(s) + 0.5) - 1))]
