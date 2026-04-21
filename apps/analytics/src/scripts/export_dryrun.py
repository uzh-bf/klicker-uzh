"""CLI entry point for the analytics dry-run exporter.

Invoked via ``pnpm --filter @klicker-uzh/analytics run dryrun:<env>`` with an
``--course-id <uuid>``; produces an ``.xlsx`` workbook with one sheet per
captured analytics table plus ``_metadata`` / ``_summary`` / optional
``_skipped_writes`` sheets.

Runs entirely in-process — no Hatchet worker / engine / token required. See
``src/dryrun/runner.py`` for the safety-layer design.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from src.dryrun.runner import DryRunAbort, run_dryrun


def _force_line_buffered_stdio() -> None:
    # Pipelines through infisical / pnpm block-buffer Python stdout, so per-day
    # progress from the analytics scripts only surfaces after minutes of silence.
    # Reconfigure both streams for line buffering up-front.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(line_buffering=True)


def main() -> None:
    _force_line_buffered_stdio()

    parser = argparse.ArgumentParser(
        prog="python -m src.scripts.export_dryrun",
        description=(
            "Read-only dry-run of the analytics pipeline for a single course. "
            "Writes an .xlsx workbook instead of persisting to Postgres."
        ),
    )
    parser.add_argument(
        "--course-id",
        required=True,
        help="UUID of the course to scope the run to.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help=(
            "Path to the .xlsx file to produce. Defaults to "
            "./analytics-dryrun-<courseId>-<YYYY-MM-DD>.xlsx"
        ),
    )
    parser.add_argument(
        "--scripts",
        default=None,
        help=(
            "Optional comma-separated whitelist of script modules to run "
            "(e.g. src.scripts.0_initial_participant_analytics). Useful for "
            "debugging a single stage faster."
        ),
    )
    parser.add_argument(
        "--unsafe-allow-rw-role",
        action="store_true",
        help=(
            "Skip the read-only Postgres role probe. ONLY use against a dev "
            "database — the Python interceptors remain the last line of defence."
        ),
    )
    args = parser.parse_args()

    output = (
        Path(args.output)
        if args.output
        else Path(
            f"./analytics-dryrun-{args.course_id}-{date.today().isoformat()}.xlsx"
        )
    )
    script_whitelist: list[str] | None = None
    if args.scripts:
        script_whitelist = [s.strip() for s in args.scripts.split(",") if s.strip()]
        if not script_whitelist:
            script_whitelist = None

    try:
        run_dryrun(
            args.course_id,
            output,
            scripts=script_whitelist,
            allow_rw_role=args.unsafe_allow_rw_role,
        )
    except DryRunAbort as exc:
        print(f"[dryrun] aborted: {exc}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
