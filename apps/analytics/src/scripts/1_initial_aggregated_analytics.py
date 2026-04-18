# This script computes the aggregated analytics on course level for a given date range
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

import os
import json
from datetime import datetime
from prisma import Prisma
import pandas as pd

# set the python path correctly for module imports to work
import sys

sys.path.append("../../")

from src.modules.aggregated_analytics.compute_aggregated_analytics import (
    compute_aggregated_analytics,
)
from src.modules.utils import analytics_window_since

db = Prisma()
db.connect()

# Script settings
verbose = False

# Settings which analytics to compute
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
_cutoff = pd.Timestamp(windows_since) if windows_since else None


def _skip_window(win_end: str) -> bool:
    if _cutoff is None:
        return False
    return pd.Timestamp(win_end) < _cutoff


if compute_daily:
    # Iterate over the date range and compute the participant analytics for each day
    for curr_date in date_range_daily:
        # determine day start and end dates required for aggregation
        specific_date = curr_date.strftime("%Y-%m-%d")
        if _skip_window(specific_date):
            continue
        day_start = specific_date + "T00:00:00.000Z"
        day_end = specific_date + "T23:59:59.999Z"
        print(f"Computing daily aggregated analytics (course) for {specific_date}")

        # compute aggregated analytics for a specific day
        timestamp = day_start
        compute_aggregated_analytics(
            db, day_start, day_end, timestamp, "DAILY", verbose
        )


if compute_weekly:
    # Iterate over the date range and compute the participant analytics for each week
    for curr_date in date_range_weekly:
        week_end_date = curr_date.strftime("%Y-%m-%d")
        if _skip_window(week_end_date):
            continue
        # determine week start and end dates required for aggregation
        week_end = week_end_date + "T23:59:59.999Z"
        week_start = (curr_date - pd.DateOffset(days=6)).strftime(
            "%Y-%m-%d"
        ) + "T00:00:00.000Z"
        print(
            f"Computing weekly aggregated analytics (course) for {week_start } to {week_end }"
        )

        # compute aggregated analytics for a specific week
        timestamp = week_end
        compute_aggregated_analytics(
            db, week_start, week_end, timestamp, "WEEKLY", verbose
        )


if compute_monthly:
    # Iterate over the date range and compute the participant analytics for each month
    for curr_date in date_range_monthly:
        month_end_date = curr_date.strftime("%Y-%m-%d")
        if _skip_window(month_end_date):
            continue
        # determine month start and end dates required for aggregation
        month_end = month_end_date + "T23:59:59.999Z"
        month_start = (curr_date - pd.offsets.MonthBegin(1)).strftime(
            "%Y-%m-%d"
        ) + "T00:00:00.000Z"
        print(
            f"Computing monthly aggregated analytics (course) for {month_start } to {month_end }"
        )

        # compute aggregated analytics for a specific month
        timestamp = month_end
        compute_aggregated_analytics(
            db, month_start, month_end, timestamp, "MONTHLY", verbose
        )


if compute_course:
    print(f"Computing course-wide aggregated analytics")

    # compute aggregated analytics over entire course based on corresponding participant analytics
    # (a constant timestamp is used here, since the data combination has to be unique
    # during querying, but only one entry per course is available by definition)
    timestamp = "1970-01-01T00:00:00.000Z"
    compute_aggregated_analytics(db, timestamp, timestamp, timestamp, "COURSE", verbose)

# Disconnect from the database
db.disconnect()
