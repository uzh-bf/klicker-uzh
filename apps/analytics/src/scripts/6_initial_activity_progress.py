# This script computes the activity progress analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

from prisma import Prisma
import sys

# set the python path correctly for module imports to work
sys.path.append("../../")

from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)
from src.modules.activity_progress.get_course_progress_activities import (
    get_course_progress_activities,
)
from src.modules.activity_progress.compute_progress_counts import (
    compute_progress_counts,
)
from src.modules.activity_progress.save_practice_quiz_progress import (
    save_practice_quiz_progress,
)
from src.modules.activity_progress.save_microlearning_progress import (
    save_microlearning_progress,
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

    # extract number of participants
    course_participants = len(course["participations"])

    # fetch all practice quizzes and microlearnings linked to the course
    pqs, mls = get_course_progress_activities(db, course_id)

    for quiz in pqs:
        started_count, completed_count, repeated_count = compute_progress_counts(quiz)

        # store results in database table
        save_practice_quiz_progress(
            db,
            course_participants,
            started_count,
            completed_count,
            repeated_count,
            course_id,
            quiz["id"],
        )

    for ml in mls:
        started_count, completed_count, repeated_count = compute_progress_counts(ml)

        # store results in database table
        save_microlearning_progress(
            db,
            course_participants,
            started_count,
            completed_count,
            course_id,
            ml["id"],
        )


# Disconnect from the database
db.disconnect()
