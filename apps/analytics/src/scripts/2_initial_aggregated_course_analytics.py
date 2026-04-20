# This script computes the aggregated course analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.modules.aggregated_course_analytics.compute_weekday_activity import (
    compute_weekday_activity,
)
from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)


def main() -> None:
    with SessionLocal() as session:
        df_courses = get_running_past_courses(session)

        for idx, course in df_courses.iterrows():
            print(
                f"Processing course", idx, "of", len(df_courses), "with id", course["id"]
            )
            compute_weekday_activity(session, course)


if __name__ == "__main__":
    main()
