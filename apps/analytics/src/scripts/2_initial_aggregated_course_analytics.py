# This script computes the aggregated course analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

from prisma import Prisma

# set the python path correctly for module imports to work
import sys

sys.path.append("../../")

from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)
from src.modules.aggregated_course_analytics.compute_weekday_activity import (
    compute_weekday_activity,
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

    # computation of activity per weekday
    compute_weekday_activity(db, course)

# Disconnect from the database
db.disconnect()
