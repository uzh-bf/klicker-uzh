# This script computes platform-level semester totals and per-course modality footprint.
# Replaces the Batch 6 ad-hoc SQL from the Proof doc with durable, auto-refreshed tables.
# All work happens in raw SQL; Python is just the orchestrator.

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.log import script_entry, script_exit
from src.modules.platform_analytics.compute_platform_analytics import (
    compute_course_modality_footprint,
    compute_platform_semester_analytics,
)
from src.modules.utils import (
    analytics_mode,
    analytics_window_since,
    check_analytics_cancellation,
    scoped_course_ids,
)


def main() -> None:
    verbose = True
    with SessionLocal() as session:
        scope = scoped_course_ids(session)
        started = script_entry(
            script=__name__,
            mode=analytics_mode(),
            scope_size=len(scope) if scope is not None else None,
            window_since=analytics_window_since(),
        )

        print("Computing platform semester analytics")
        compute_platform_semester_analytics(session, verbose)

        check_analytics_cancellation()
        print("Updating per-course modality footprint on AggregatedCourseAnalytics")
        compute_course_modality_footprint(session, verbose)

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
