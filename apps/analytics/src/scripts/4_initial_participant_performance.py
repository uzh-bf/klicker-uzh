# This script computes the initial participant performance analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

import sys

import pandas as pd
from sqlalchemy import select

sys.path.append("../../")

from src.db import SessionLocal
from src.db_helpers import row_to_dict
from src.log import script_entry, script_exit
from src.models import QuestionResponse
from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)
from src.modules.participant_performance.compute_performance_levels import (
    compute_performance_levels,
)
from src.modules.participant_performance.compute_response_error_rates import (
    compute_response_error_rates,
)
from src.modules.participant_performance.save_participant_performance import (
    save_participant_performance,
)
from src.modules.utils import (
    analytics_mode,
    analytics_window_since,
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
            course_id = course["id"]
            print(
                f"Processing course", idx, "of", len(df_courses), "with id", course_id
            )

            responses = session.execute(
                select(QuestionResponse).where(QuestionResponse.courseId == course_id)
            ).scalars().all()
            df_responses = pd.DataFrame([row_to_dict(r) for r in responses])

            if df_responses.empty:
                print("No responses linked to course", course_id)
                continue

            df_performance = compute_response_error_rates(df_responses)
            df_performance = compute_performance_levels(df_performance)

            save_participant_performance(session, df_performance, course_id)

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
