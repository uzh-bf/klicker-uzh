# This script computes platform-level semester totals and per-course modality footprint.
# Replaces the Batch 6 ad-hoc SQL from the Proof doc with durable, auto-refreshed tables.
# All work happens in raw SQL; Python is just the orchestrator.

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.modules.platform_analytics.compute_platform_analytics import (
    compute_course_modality_footprint,
    compute_platform_semester_analytics,
)


def main() -> None:
    verbose = True
    with SessionLocal() as session:
        print("Computing platform semester analytics")
        compute_platform_semester_analytics(session, verbose)

        print("Updating per-course modality footprint on AggregatedCourseAnalytics")
        compute_course_modality_footprint(session, verbose)


if __name__ == "__main__":
    main()
