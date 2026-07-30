# This script computes the initial participant performance analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

from prisma import Prisma
import pandas as pd
import sys

# set the python path correctly for module imports to work
sys.path.append("../../")

from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)
from src.modules.participant_performance.compute_response_error_rates import (
    compute_response_error_rates,
)
from src.modules.participant_performance.compute_performance_levels import (
    compute_performance_levels,
)
from src.modules.participant_performance.save_participant_performance import (
    save_participant_performance,
)
from src.modules.eligible_response_details import get_eligible_course_activities

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

    # Rebuild response-level counters from eligible response details. The
    # cumulative QuestionResponse rows combine activity from before and after a
    # participant's inclusion boundary and cannot be safely filtered.
    _, practice_quizzes, microlearnings = get_eligible_course_activities(db, course_id)
    responses = [
        response
        for activity in practice_quizzes + microlearnings
        for stack in activity["stacks"]
        for element in stack["elements"]
        for response in element["responses"]
    ]
    df_responses = pd.DataFrame(responses)

    # if no responses are linked to the course, skip the iteration
    if df_responses.empty:
        print("No responses linked to course", course_id)
        continue

    df_performance = compute_response_error_rates(df_responses)
    df_performance = compute_performance_levels(df_performance)

    # store computed performance analytics in the corresponding database table
    save_participant_performance(db, df_performance, course_id)


# Disconnect from the database
db.disconnect()
