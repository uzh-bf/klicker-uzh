"""Generate an ignored SQLAlchemy model reference without exposing credentials."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy.engine import make_url
from sqlacodegen.cli import main as sqlacodegen_main


def main() -> None:
    raw_url = os.environ.get("DATABASE_URL")
    if not raw_url:
        raise SystemExit("DATABASE_URL is required")

    url = make_url(raw_url)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")

    output = Path(__file__).resolve().parents[1] / "src/models.generated.py"
    original_argv = sys.argv
    try:
        sys.argv = [
            "sqlacodegen",
            "--generator",
            "declarative",
            url.render_as_string(hide_password=False),
            "--outfile",
            str(output),
        ]
        sqlacodegen_main()
    finally:
        sys.argv = original_argv


if __name__ == "__main__":
    main()
