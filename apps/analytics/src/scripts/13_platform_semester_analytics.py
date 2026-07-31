# This script computes platform-level semester totals and per-course modality footprint.
# Replaces the Batch 6 ad-hoc SQL from the Proof doc with durable, auto-refreshed tables.
# All work happens in raw SQL; Python is just the orchestrator.

import sys
from prisma import Prisma

sys.path.append("../../")

from src.modules.platform_analytics.compute_platform_analytics import (
    compute_platform_semester_analytics,
    compute_course_modality_footprint,
)

db = Prisma()
db.connect()

verbose = True

print("Computing platform semester analytics")
compute_platform_semester_analytics(db, verbose)

print("Updating per-course modality footprint on AggregatedCourseAnalytics")
compute_course_modality_footprint(db, verbose)

db.disconnect()
