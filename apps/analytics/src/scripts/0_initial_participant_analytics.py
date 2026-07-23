# This script computes the participant analytics for a given time range
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

from datetime import datetime

import pandas as pd
from sqlalchemy import select

# set the python path correctly for module imports to work
import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.log import script_entry, script_exit
from src.models import Course
from src.modules.participant_analytics.compute_participant_analytics import (
    compute_participant_analytics,
)
from src.modules.participant_analytics.compute_participant_course_analytics import (
    compute_participant_course_analytics,
)
from src.modules.utils import (
    analytics_mode,
    analytics_window_since,
    apply_course_scope,
    check_analytics_cancellation,
    scoped_course_ids,
    should_skip_window,
)


def main() -> None:
    verbose = False
    compute_daily = True
    compute_weekly = True
    compute_monthly = True
    compute_course = True

    start_date = "2022-10-23"
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
                check_analytics_cancellation()
                specific_date = curr_date.strftime("%Y-%m-%d")
                if should_skip_window(specific_date, windows_since):
                    continue
                print(f"Computing daily participant analytics for {specific_date}")
                win_start = specific_date + "T00:00:00.000Z"
                win_end = specific_date + "T23:59:59.999Z"
                compute_participant_analytics(
                    session, win_start, win_end, win_start, "DAILY", verbose
                )

        if compute_weekly:
            for curr_date in date_range_weekly:
                check_analytics_cancellation()
                week_end_date = curr_date.strftime("%Y-%m-%d")
                if should_skip_window(week_end_date, windows_since):
                    continue
                week_end = week_end_date + "T23:59:59.999Z"
                week_start = (curr_date - pd.DateOffset(days=6)).strftime(
                    "%Y-%m-%d"
                ) + "T00:00:00.000Z"
                print(
                    f"Computing weekly participant analytics for {week_start} to {week_end}"
                )
                compute_participant_analytics(
                    session, week_start, week_end, week_end, "WEEKLY", verbose
                )

        if compute_monthly:
            for curr_date in date_range_monthly:
                check_analytics_cancellation()
                month_end_date = curr_date.strftime("%Y-%m-%d")
                if should_skip_window(month_end_date, windows_since):
                    continue
                month_end = month_end_date + "T23:59:59.999Z"
                month_start = (curr_date - pd.offsets.MonthBegin(1)).strftime(
                    "%Y-%m-%d"
                ) + "T00:00:00.000Z"
                print(
                    f"Computing monthly participant analytics for {month_start} to {month_end}"
                )
                compute_participant_analytics(
                    session, month_start, month_end, month_end, "MONTHLY", verbose
                )

        if compute_course:
            check_analytics_cancellation()
            curr_date = datetime.now()

            stmt = select(Course.id, Course.startDate, Course.endDate).where(
                Course.startDate <= curr_date
            )
            stmt = apply_course_scope(scope, stmt, Course.id)
            if stmt is None:
                print(
                    "[0_initial_participant_analytics] empty course scope — skipping COURSE pass"
                )
                df_courses = pd.DataFrame()
            else:
                df_courses = pd.DataFrame(
                    [dict(row) for row in session.execute(stmt).mappings().all()]
                )

            scope_note = f" (scoped to {len(scope)} ids)" if scope is not None else ""
            print(
                f"Found {len(df_courses)} courses with a start date before {curr_date}{scope_note}"
            )

            if not df_courses.empty:
                courses_without_responses = compute_participant_course_analytics(
                    session, df_courses, verbose
                )
                print(
                    f"Found {courses_without_responses} courses without any responses"
                )

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
