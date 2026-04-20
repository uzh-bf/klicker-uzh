# Flips Course.areAnalyticsValid / analyticsLastComputedAt / chatAnalyticsValidAt for
# every course that ended up with analytics rows written in this run.
# Must be the LAST script in the analytics pipeline.

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.modules.analytics_validity.mark_analytics_valid import mark_analytics_valid


def main() -> None:
    with SessionLocal() as session:
        mark_analytics_valid(session, verbose=True)


if __name__ == "__main__":
    main()
