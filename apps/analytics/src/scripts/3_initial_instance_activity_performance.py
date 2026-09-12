# This script computes the instance activity performance analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

from prisma import Prisma
import sys

# set the python path correctly for module imports to work
sys.path.append("../../")

from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)
from src.modules.instance_activity_performance.get_course_activities import (
    get_course_activities,
)
from src.modules.instance_activity_performance.compute_instance_performance import (
    compute_instance_performance,
)
from src.modules.instance_activity_performance.agg_activity_performance import (
    agg_activity_performance,
)
from src.modules.instance_activity_performance.save_instance_performances import (
    save_instance_performances,
)
from src.modules.instance_activity_performance.save_activity_performance import (
    save_activity_performance,
)

db = Prisma()
db.connect()

# Script settings
verbose = False

# Fetch all courses from the database
df_courses = get_running_past_courses(db)

# Iterate over the course and fetch all question responses linked to it
for idx, course in df_courses.iterrows():
    course_id = course["id"]
    print("Processing course", idx, "of", len(df_courses), "with id", course_id)

    # fetch all practice quizzes and microlearnings linked to the course
    pqs, mls = get_course_activities(db, course_id)

    for quiz in pqs:
        # compute instance performances
        df_instance_performance = compute_instance_performance(db, quiz)

        # if no instances with values were found, skip the activity
        if df_instance_performance.empty:
            continue

        # compute the activity performance by aggregating the all instance performances
        activity_performance = agg_activity_performance(df_instance_performance)

        # save instance performance data
        save_instance_performances(db, df_instance_performance, course_id)

        # save activity performance data
        save_activity_performance(db, activity_performance, course_id, practice_quiz_id=quiz["id"])

    for ml in mls:
        # compute instance performances
        df_instance_performance = compute_instance_performance(db, ml, total_only=True)

        # if no instances with values were found, skip the activity
        if df_instance_performance.empty:
            continue

        # compute the activity performance by aggregating the all instance performances
        activity_performance = agg_activity_performance(df_instance_performance)

        # save instance performance data
        save_instance_performances(db, df_instance_performance, course_id, total_only=True)

        # save activity performance data
        save_activity_performance(db, activity_performance, course_id, microlearning_id=ml["id"])

# Disconnect from the database
db.disconnect()
