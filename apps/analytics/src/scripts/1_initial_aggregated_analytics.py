# This script computes the aggregated analytics on course level for a given date range
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

from datetime import datetime

import pandas as pd

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.log import script_entry, script_exit
from src.modules.aggregated_analytics.compute_aggregated_analytics import (
    compute_aggregated_analytics,
)
from src.modules.utils import (
    COURSE_TIMESTAMP,
    analytics_mode,
    analytics_window_since,
    scoped_course_ids,
    should_skip_window,
)


def main() -> None:
    verbose = False
    compute_daily = True
    compute_weekly = True
    compute_monthly = True
    compute_course = True

    start_date = "2021-01-01"
    end_date = datetime.now().strftime("%Y-%m-%d")
    date_range_daily = pd.date_range(start=start_date, end=end_date, freq="D")
    date_range_weekly = pd.date_range(start=start_date, end=end_date, freq="W")
    date_range_monthly = pd.date_range(start=start_date, end=end_date, freq="ME")

    windows_since = analytics_window_since()
    mode = analytics_mode()

    with SessionLocal() as session:
        scope = scoped_course_ids(session)
        started = script_entry(
            script=__name__,
            mode=mode,
            scope_size=len(scope) if scope is not None else None,
            window_since=windows_since,
        )
        if compute_daily:
            for curr_date in date_range_daily:
                specific_date = curr_date.strftime("%Y-%m-%d")
                if should_skip_window(specific_date, windows_since):
                    continue
                day_start = specific_date + "T00:00:00.000Z"
                day_end = specific_date + "T23:59:59.999Z"
                print(
                    f"Computing daily aggregated analytics (course) for {specific_date}"
                )
                compute_aggregated_analytics(
                    session,
                    day_start,
                    day_end,
                    day_start,
                    "DAILY",
                    verbose,
                    course_ids=scope,
                )

        if compute_weekly:
            for curr_date in date_range_weekly:
                week_end_date = curr_date.strftime("%Y-%m-%d")
                if should_skip_window(week_end_date, windows_since):
                    continue
                week_end = week_end_date + "T23:59:59.999Z"
                week_start = (curr_date - pd.DateOffset(days=6)).strftime(
                    "%Y-%m-%d"
                ) + "T00:00:00.000Z"
                print(
                    f"Computing weekly aggregated analytics (course) for "
                    f"{week_start} to {week_end}"
                )
                compute_aggregated_analytics(
                    session,
                    week_start,
                    week_end,
                    week_end,
                    "WEEKLY",
                    verbose,
                    course_ids=scope,
                )

        if compute_monthly:
            for curr_date in date_range_monthly:
                month_end_date = curr_date.strftime("%Y-%m-%d")
                if should_skip_window(month_end_date, windows_since):
                    continue
                month_end = month_end_date + "T23:59:59.999Z"
                month_start = (curr_date - pd.offsets.MonthBegin(1)).strftime(
                    "%Y-%m-%d"
                ) + "T00:00:00.000Z"
                print(
                    f"Computing monthly aggregated analytics (course) for "
                    f"{month_start} to {month_end}"
                )
                compute_aggregated_analytics(
                    session,
                    month_start,
                    month_end,
                    month_end,
                    "MONTHLY",
                    verbose,
                    course_ids=scope,
                )

        if compute_course:
            print("Computing course-wide aggregated analytics")
            timestamp = COURSE_TIMESTAMP
            compute_aggregated_analytics(
                session,
                timestamp,
                timestamp,
                timestamp,
                "COURSE",
                verbose,
                course_ids=scope,
            )

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
