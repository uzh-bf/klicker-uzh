# This script computes the participant analytics for a given time range
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

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
from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
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

if compute_daily:
    # Iterate over the date range and compute the participant analytics for each day
    for curr_date in date_range_daily:
        print(f"Computing daily participant analytics for {curr_date.strftime('%Y-%m-%d')}")
        specific_date = curr_date.strftime("%Y-%m-%d")

        # Fetch all question response detail entries for a specific day
        start_date = specific_date + "T00:00:00.000Z"
        end_date = specific_date + "T23:59:59.999Z"

        # Compute participant analytics for a specific day
        timestamp = start_date
        compute_participant_analytics(db, start_date, end_date, timestamp, "DAILY", verbose)

if compute_weekly:
    # Iterate over the date range and compute the participant analytics for each week
    for curr_date in date_range_weekly:
        # Fetch all question response detail entries for a specific week
        end_date = curr_date.strftime("%Y-%m-%d") + "T23:59:59.999Z"
        start_date = (curr_date - pd.DateOffset(days=6)).strftime("%Y-%m-%d") + "T00:00:00.000Z"
        print(f"Computing weekly participant analytics for {start_date} to {end_date}")

        # Compute participant analytics for a specific week
        timestamp = end_date
        compute_participant_analytics(db, start_date, end_date, timestamp, "WEEKLY", verbose)

if compute_monthly:
    # Iterate over the date range and compute the participant analytics for each month
    for curr_date in date_range_monthly:
        # Fetch all question response detail entries for a specific month
        end_date = curr_date.strftime("%Y-%m-%d") + "T23:59:59.999Z"
        start_date = (curr_date - pd.offsets.MonthBegin(1)).strftime("%Y-%m-%d") + "T00:00:00.000Z"
        print(f"Computing monthly participant analytics for {start_date} to {end_date}")

        # Compute participant analytics for a specific month
        timestamp = end_date
        compute_participant_analytics(db, start_date, end_date, timestamp, "MONTHLY", verbose)

# ! Compute course analytics
# Fetch all ongoing / past courses
if compute_course:
    curr_date = datetime.now().strftime("%Y-%m-%d")
    df_courses = get_running_past_courses(db)
    print("Found {} courses with a start date before {}".format(len(df_courses), curr_date))

    courses_without_responses = compute_participant_course_analytics(db, df_courses, verbose)

    print("Found {} courses without any responses".format(courses_without_responses))

# Disconnect from the database
db.disconnect()
