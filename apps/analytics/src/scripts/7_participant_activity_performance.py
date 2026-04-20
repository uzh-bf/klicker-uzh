# This script compute the participant activity performance analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.modules.participant_activity_performance.agg_participant_activity_performance import (
    agg_participant_activity_performance,
)
from src.modules.participant_activity_performance.prepare_participant_activity_data import (
    prepare_participant_activity_data,
)
from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)


def main() -> None:
    with SessionLocal() as session:
        df_courses = get_running_past_courses(session)

        for idx, base_course in df_courses.iterrows():
            print(
                f"Processing course",
                idx,
                "of",
                len(df_courses),
                "with id",
                base_course["id"],
            )

            df_activities, df_responses, participant_ids = (
                prepare_participant_activity_data(session, base_course["id"])
            )

            if df_responses.empty:
                continue

            agg_participant_activity_performance(
                session, df_responses, df_activities, participant_ids
            )


if __name__ == "__main__":
    main()
