# This script computes the participant course analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.modules.participant_course_analytics.compute_participant_activity import (
    compute_participant_activity,
)
from src.modules.participant_course_analytics.get_active_weeks import get_active_weeks
from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)
from src.modules.participant_course_analytics.save_participant_course_analytics import (
    save_participant_course_analytics,
)


def main() -> None:
    with SessionLocal() as session:
        df_courses = get_running_past_courses(session)

        for idx, course in df_courses.iterrows():
            print(
                f"Processing course", idx, "of", len(df_courses), "with id", course["id"]
            )

            df_activity = get_active_weeks(session, course)

            if df_activity.empty:
                print("No participant was active in the course, skipping")
                continue

            df_activity = compute_participant_activity(
                session, df_activity, course["id"], course["startDate"], course["endDate"]
            )

            save_participant_course_analytics(session, df_activity)


if __name__ == "__main__":
    main()
