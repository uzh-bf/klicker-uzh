# This script computes the instance activity performance analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.log import script_entry, script_exit
from src.modules.instance_activity_performance.agg_activity_performance import (
    agg_activity_performance,
)
from src.modules.instance_activity_performance.compute_instance_performance import (
    compute_instance_performance,
)
from src.modules.instance_activity_performance.get_course_activities import (
    get_course_activities,
)
from src.modules.instance_activity_performance.save_activity_performance import (
    save_activity_performance,
)
from src.modules.instance_activity_performance.save_instance_performances import (
    save_instance_performances,
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

        for idx, course in df_courses.iterrows():
            check_analytics_cancellation()
            course_id = course["id"]
            print("Processing course", idx, "of", len(df_courses), "with id", course_id)

            pqs, mls = get_course_activities(session, course_id)

            for quiz in pqs:
                check_analytics_cancellation()
                df_instance_performance = compute_instance_performance(session, quiz)
                if df_instance_performance.empty:
                    continue
                activity_performance = agg_activity_performance(df_instance_performance)
                save_instance_performances(session, df_instance_performance, course_id)
                save_activity_performance(session, activity_performance, course_id, practice_quiz_id=quiz["id"])

            for ml in mls:
                check_analytics_cancellation()
                df_instance_performance = compute_instance_performance(session, ml, total_only=True)
                if df_instance_performance.empty:
                    continue
                activity_performance = agg_activity_performance(df_instance_performance)
                save_instance_performances(session, df_instance_performance, course_id, total_only=True)
                save_activity_performance(session, activity_performance, course_id, microlearning_id=ml["id"])

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
