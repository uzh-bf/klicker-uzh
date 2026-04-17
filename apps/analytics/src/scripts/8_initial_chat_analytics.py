# This script computes the initial participant chat analytics.
# Populates ParticipantChatAnalytics for DAILY / WEEKLY / MONTHLY / COURSE windows.
# Raw-SQL driven — the heavy aggregation happens in Postgres; Python just orchestrates windows.

import sys
from datetime import datetime
from prisma import Prisma
import pandas as pd

# set the python path correctly for module imports to work
sys.path.append("../../")

from src.modules.chat_analytics.compute_participant_chat_analytics import (
    compute_participant_chat_analytics,
    COURSE_TIMESTAMP,
)

db = Prisma()
db.connect()

# Script settings
verbose = False

compute_daily = True
compute_weekly = True
compute_monthly = True
compute_course = True

# Matches the start used by script 0 for coherence; chat data only exists from 2025-09 onward
# but scanning empty windows is cheap.
start_date = "2022-10-23"
end_date = datetime.now().strftime("%Y-%m-%d")

date_range_daily = pd.date_range(start=start_date, end=end_date, freq="D")
date_range_weekly = pd.date_range(start=start_date, end=end_date, freq="W")
date_range_monthly = pd.date_range(start=start_date, end=end_date, freq="ME")

if compute_daily:
    for curr_date in date_range_daily:
        specific_date = curr_date.strftime("%Y-%m-%d")
        win_start = specific_date + "T00:00:00.000Z"
        win_end = specific_date + "T23:59:59.999Z"
        print(f"Computing daily participant chat analytics for {specific_date}")
        compute_participant_chat_analytics(
            db, win_start, win_end, specific_date, "DAILY", verbose
        )

if compute_weekly:
    for curr_date in date_range_weekly:
        week_end = curr_date.strftime("%Y-%m-%d")
        win_end = week_end + "T23:59:59.999Z"
        win_start = (curr_date - pd.DateOffset(days=6)).strftime("%Y-%m-%d") + "T00:00:00.000Z"
        print(f"Computing weekly participant chat analytics for {win_start} to {win_end}")
        compute_participant_chat_analytics(
            db, win_start, win_end, week_end, "WEEKLY", verbose
        )

if compute_monthly:
    for curr_date in date_range_monthly:
        month_end = curr_date.strftime("%Y-%m-%d")
        win_end = month_end + "T23:59:59.999Z"
        win_start = (curr_date - pd.offsets.MonthBegin(1)).strftime("%Y-%m-%d") + "T00:00:00.000Z"
        print(f"Computing monthly participant chat analytics for {win_start} to {win_end}")
        compute_participant_chat_analytics(
            db, win_start, win_end, month_end, "MONTHLY", verbose
        )

if compute_course:
    # One COURSE-wide row per (participant, chatbot) covering the full history.
    win_start = start_date + "T00:00:00.000Z"
    win_end = end_date + "T23:59:59.999Z"
    print(f"Computing course-wide participant chat analytics for {win_start} to {win_end}")
    compute_participant_chat_analytics(
        db, win_start, win_end, COURSE_TIMESTAMP, "COURSE", verbose
    )

db.disconnect()
