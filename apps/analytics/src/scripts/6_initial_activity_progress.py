# This script computes the activity progress analytics
# ! This script is a copy of the corresponding notebook content and needs to be kept in sync with it

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.modules.activity_progress.compute_progress_counts import (
    compute_progress_counts,
)
from src.modules.activity_progress.get_course_progress_activities import (
    get_course_progress_activities,
)
from src.modules.activity_progress.save_microlearning_progress import (
    save_microlearning_progress,
)
from src.modules.activity_progress.save_practice_quiz_progress import (
    save_practice_quiz_progress,
)
from src.modules.participant_course_analytics.get_running_past_courses import (
    get_running_past_courses,
)


def main() -> None:
    with SessionLocal() as session:
        df_courses = get_running_past_courses(session)

        for idx, course in df_courses.iterrows():
            course_id = course["id"]
            print(
                f"Processing course", idx, "of", len(df_courses), "with id", course_id
            )

            course_participants = len(course["participations"])
            pqs, mls = get_course_progress_activities(session, course_id)

            for quiz in pqs:
                started_count, completed_count, repeated_count = compute_progress_counts(
                    quiz
                )
                save_practice_quiz_progress(
                    session,
                    course_participants,
                    started_count,
                    completed_count,
                    repeated_count,
                    course_id,
                    quiz["id"],
                )

            for ml in mls:
                started_count, completed_count, _ = compute_progress_counts(ml)
                save_microlearning_progress(
                    session,
                    course_participants,
                    started_count,
                    completed_count,
                    course_id,
                    ml["id"],
                )


if __name__ == "__main__":
    main()
