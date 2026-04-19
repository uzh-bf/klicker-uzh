# This script computes the participant analytics for a given time range
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

import os
import json
from datetime import datetime
from prisma import Prisma
import pandas as pd

# set the python path correctly for module imports to work
import sys

sys.path.append("../../")

from src.modules.participant_analytics.compute_participant_analytics import (
    compute_participant_analytics,
)
from src.modules.participant_analytics.compute_participant_course_analytics import (
    compute_participant_course_analytics,
)
from src.modules.utils import (
    analytics_window_since,
    apply_course_scope,
    scoped_course_ids,
    should_skip_window,
)

db = Prisma()
db.connect()

# Script settings
verbose = False

# Settings which analytics to compute
compute_daily = True
compute_weekly = True
compute_monthly = True
compute_course = True

# ! Compute daily / weekly / monthly analytics
# Print all dates between the 2022-10-23 and today
start_date = "2022-10-23"
end_date = datetime.now().strftime("%Y-%m-%d")
date_range_daily = pd.date_range(start=start_date, end=end_date, freq="D")
date_range_weekly = pd.date_range(start=start_date, end=end_date, freq="W")
date_range_monthly = pd.date_range(start=start_date, end=end_date, freq="ME")

windows_since = analytics_window_since()

if compute_daily:
    # Iterate over the date range and compute the participant analytics for each day
    for curr_date in date_range_daily:
        specific_date = curr_date.strftime("%Y-%m-%d")
        if should_skip_window(specific_date, windows_since):
            continue
        print(f"Computing daily participant analytics for {specific_date}")

        # Fetch all question response detail entries for a specific day
        start_date = specific_date + "T00:00:00.000Z"
        end_date = specific_date + "T23:59:59.999Z"

        # Compute participant analytics for a specific day
        timestamp = start_date
        compute_participant_analytics(
            db, start_date, end_date, timestamp, "DAILY", verbose
        )

if compute_weekly:
    # Iterate over the date range and compute the participant analytics for each week
    for curr_date in date_range_weekly:
        week_end_date = curr_date.strftime("%Y-%m-%d")
        if should_skip_window(week_end_date, windows_since):
            continue
        # Fetch all question response detail entries for a specific week
        end_date = week_end_date + "T23:59:59.999Z"
        start_date = (curr_date - pd.DateOffset(days=6)).strftime(
            "%Y-%m-%d"
        ) + "T00:00:00.000Z"
        print(f"Computing weekly participant analytics for {start_date} to {end_date}")

        # Compute participant analytics for a specific week
        timestamp = end_date
        compute_participant_analytics(
            db, start_date, end_date, timestamp, "WEEKLY", verbose
        )

if compute_monthly:
    # Iterate over the date range and compute the participant analytics for each month
    for curr_date in date_range_monthly:
        month_end_date = curr_date.strftime("%Y-%m-%d")
        if should_skip_window(month_end_date, windows_since):
            continue
        # Fetch all question response detail entries for a specific month
        end_date = month_end_date + "T23:59:59.999Z"
        start_date = (curr_date - pd.offsets.MonthBegin(1)).strftime(
            "%Y-%m-%d"
        ) + "T00:00:00.000Z"
        print(f"Computing monthly participant analytics for {start_date} to {end_date}")

        # Compute participant analytics for a specific month
        timestamp = end_date
        compute_participant_analytics(
            db, start_date, end_date, timestamp, "MONTHLY", verbose
        )

# ! Compute course analytics
# Fetch all ongoing / past courses
if compute_course:
    curr_date = datetime.now().strftime("%Y-%m-%d")
    scope = scoped_course_ids(db)
    where = apply_course_scope(
        {"startDate": {"lte": curr_date + "T23:59:59.999Z"}},
        scope,
    )

    if where is None:
        print(
            "[0_initial_participant_analytics] empty course scope — skipping COURSE pass"
        )
        df_courses = pd.DataFrame()
    else:
        courses = db.course.find_many(where=where)
        df_courses = pd.DataFrame(list(map(lambda x: x.dict(), courses)))

    scope_note = f" (scoped to {len(scope)} ids)" if scope is not None else ""
    print(
        f"Found {len(df_courses)} courses with a start date before {curr_date}{scope_note}"
    )

    if not df_courses.empty:
        courses_without_responses = compute_participant_course_analytics(
            db, df_courses, verbose
        )
        print(
            f"Found {courses_without_responses} courses without any responses"
        )

# Disconnect from the database
db.disconnect()
