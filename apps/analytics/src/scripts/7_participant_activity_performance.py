# This script compute the participant activity performance analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it


from prisma import Prisma

# set the python path correctly for module imports to work
import sys

sys.path.append("../../")

from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)
from src.modules.participant_activity_performance.prepare_participant_activity_data import (
    prepare_participant_activity_data,
)
from src.modules.participant_activity_performance.agg_participant_activity_performance import (
    agg_participant_activity_performance,
)


db = Prisma()
db.connect()

# Script settings
verbose = False


# find all courses that started in the past
df_courses = get_running_past_courses(db)

# iterate over all courses and compute the participant course analytics
for idx, base_course in df_courses.iterrows():
    print("Processing course", idx, "of", len(df_courses), "with id", base_course["id"])

    df_activities, df_responses, participant_ids = prepare_participant_activity_data(db, base_course["id"])

    # if no responses were submitted, skip the course
    if df_responses.empty:
        continue

    # aggregate participant activity performance data and store in the corresponding database table
    agg_participant_activity_performance(db, df_responses, df_activities, participant_ids, base_course["id"])


# Disconnect from the database
db.disconnect()
