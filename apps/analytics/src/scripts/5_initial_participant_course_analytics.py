# This script computes the participant course analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it


from prisma import Prisma

# set the python path correctly for module imports to work
import sys

sys.path.append("../../")

from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)
from src.modules.participant_course_analytics.get_active_weeks import get_active_weeks
from src.modules.participant_course_analytics.compute_participant_activity import (
    compute_participant_activity,
)
from src.modules.participant_course_analytics.save_participant_course_analytics import (
    save_participant_course_analytics,
)


db = Prisma()
db.connect()

# Script settings
verbose = False


# find all courses that started in the past
df_courses = get_running_past_courses(db)

# iterate over all courses and compute the participant course analytics
for idx, course in df_courses.iterrows():
    print("Processing course", idx, "of", len(df_courses), "with id", course["id"])

    # compute the number of active weeks per participant and activity level
    df_activity = get_active_weeks(db, course)

    # if the dataframe is empty, no participant was active in the course and the course should be skipped
    if df_activity.empty:
        print("No participant was active in the course, skipping")
        continue

    # compute the number of active days per week and mean elements per day
    df_activity = compute_participant_activity(db, df_activity, course["id"], course["startDate"], course["endDate"])

    # store the computed participant course analytics
    save_participant_course_analytics(db, df_activity)


# Disconnect from the database
db.disconnect()
