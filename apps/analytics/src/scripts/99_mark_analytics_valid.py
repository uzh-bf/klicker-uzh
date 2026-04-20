# Flips Course.areAnalyticsValid / analyticsLastComputedAt / chatAnalyticsValidAt for
# every course that ended up with analytics rows written in this run.
# Must be the LAST script in the analytics pipeline.

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.log import script_entry, script_exit
from src.modules.analytics_validity.mark_analytics_valid import mark_analytics_valid
from src.modules.utils import (
    analytics_mode,
    analytics_window_since,
    scoped_course_ids,
)


def main() -> None:
    with SessionLocal() as session:
        scope = scoped_course_ids(session)
        started = script_entry(
            script=__name__,
            mode=analytics_mode(),
            scope_size=len(scope) if scope is not None else None,
            window_since=analytics_window_since(),
        )

        mark_analytics_valid(session, verbose=True)

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
