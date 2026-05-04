"""Generate src/klicker_mcp/gql/ops.py from packages/graphql/src/public/server.json.

This script reads the persisted-operations manifest shipped by `@klicker-uzh/graphql`,
parses each GraphQL document to find its root operation name, and emits a
`{operation_name: sha256_hash}` mapping that the MCP client uses at request time.

The KlickerUZH backend blocks arbitrary GraphQL in production (only APQ-shaped
requests are accepted), so sending queries by hash is the only supported path.

Run with: `uv run poe gen-ops`.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve()
APP_MCP = SCRIPT.parent.parent
REPO_ROOT = APP_MCP.parent.parent
DEFAULT_SRC = REPO_ROOT / "packages" / "graphql" / "src" / "public" / "server.json"
OUT = APP_MCP / "src" / "klicker_mcp" / "gql" / "ops.py"

OP_RE = re.compile(
    r"^\s*(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)",
    re.MULTILINE,
)


def extract_operation_names(query_text: str) -> list[str]:
    return OP_RE.findall(query_text)


def main(src: Path = DEFAULT_SRC, out: Path = OUT) -> int:
    if not src.exists():
        print(f"error: server.json not found at {src}", file=sys.stderr)
        return 1

    data: dict[str, str] = json.loads(src.read_text())
    by_name: dict[str, str] = {}
    collisions: dict[str, list[str]] = {}
    skipped_fragments = 0

    for sha, query_text in data.items():
        names = extract_operation_names(query_text)
        if not names:
            skipped_fragments += 1
            continue
        for name in names:
            if name in by_name and by_name[name] != sha:
                collisions.setdefault(name, [by_name[name]]).append(sha)
            else:
                by_name[name] = sha

    if collisions:
        for name, hashes in collisions.items():
            print(
                f"warning: operation {name!r} resolves to multiple hashes: {hashes}",
                file=sys.stderr,
            )

    out.parent.mkdir(parents=True, exist_ok=True)
    header = (
        '"""Generated file: do not edit by hand.\n\n'
        "Mapping of KlickerUZH GraphQL operation names to their persisted-query\n"
        "sha256 hashes. Regenerate with `uv run poe gen-ops` after the graphql\n"
        "package rebuilds.\n"
        '"""\n\n'
        "from __future__ import annotations\n\n"
        "OPERATIONS: dict[str, str] = {\n"
    )
    body_lines = [f'    "{name}": "{by_name[name]}",' for name in sorted(by_name)]
    content = header + "\n".join(body_lines) + "\n}\n"
    out.write_text(content)

    print(f"Wrote {len(by_name)} operations to {out} (skipped {skipped_fragments} fragment-only documents)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
