from datetime import datetime
from sqlalchemy.orm import Session

from src.modules.utils import check_analytics_cancellation
from .compute_correctness import compute_correctness
from .aggregate_analytics import aggregate_analytics
from .get_participant_responses import get_participant_responses
from .save_participant_analytics import save_participant_analytics


def compute_participant_course_analytics(session: Session, df_courses, verbose=False):
    courses_without_responses = 0

    for idx, course in df_courses.iterrows():
        check_analytics_cancellation()
        print(f"Computing participant analytics for course {idx} out of {len(df_courses)}")
        course_id = course["id"]
        course_start_date = course["startDate"]
        course_end_date = course["endDate"]

        df_details = get_participant_responses(
            session,
            str(course_start_date),
            str(course_end_date),
            verbose,
            course_ids=[str(course_id)],
        )

        if df_details.empty:
            courses_without_responses += 1
            print("No eligible detail responses found for course {}".format(course_id))
            continue

        df_details, df_element_instances = compute_correctness(session, df_details, verbose)

        if df_details is None:
            print(f"No participant responses found for {course_start_date} to {course_end_date}.")
            continue

        df_analytics = aggregate_analytics(df_details, include_first_last=True)

        end_curr_date = datetime.now().strftime("%Y-%m-%d")
        course_end_str = (
            course_end_date.strftime("%Y-%m-%d") if hasattr(course_end_date, "strftime") else str(course_end_date)[:10]
        )
        timestamp = course_end_str if course_end_str < end_curr_date else end_curr_date
        save_participant_analytics(session, df_analytics, timestamp, "COURSE")

    return courses_without_responses
