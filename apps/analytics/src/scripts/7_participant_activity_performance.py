# This script compute the participant activity performance analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.log import script_entry, script_exit
from src.modules.participant_activity_performance.agg_participant_activity_performance import (
    agg_participant_activity_performance,
)
from src.modules.participant_activity_performance.prepare_participant_activity_data import (
    prepare_participant_activity_data,
)
from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)
from src.modules.utils import (
    analytics_mode,
    analytics_window_since,
    check_analytics_cancellation,
    scoped_course_ids,
)


def main() -> None:
    with SessionLocal() as session:
        scope = scoped_course_ids(session)
        started = script_entry(
            script=__name__,
            mode=analytics_mode(),
            scope_size=len(scope) if scope is not None else None,
            window_since=analytics_window_since(),
        )

        df_courses = get_running_past_courses(session)

        for idx, base_course in df_courses.iterrows():
            check_analytics_cancellation()
            print(
                f"Processing course",
                idx,
                "of",
                len(df_courses),
                "with id",
                base_course["id"],
            )

            df_activities, df_responses, participant_ids = prepare_participant_activity_data(session, base_course["id"])

            if df_responses.empty:
                continue

            agg_participant_activity_performance(session, df_responses, df_activities, participant_ids)

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
