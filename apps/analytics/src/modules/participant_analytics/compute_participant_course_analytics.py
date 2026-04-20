import pandas as pd
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.db_helpers import row_to_dict
from src.models import Participation, QuestionResponse, QuestionResponseDetail
from .compute_correctness import compute_correctness
from .aggregate_analytics import aggregate_analytics
from .save_participant_analytics import save_participant_analytics


def compute_participant_course_analytics(session: Session, df_courses, verbose=False):
    courses_without_responses = 0

    for idx, course in df_courses.iterrows():
        print(
            f"Computing participant analytics for course {idx} out of {len(df_courses)}"
        )
        course_id = course["id"]
        course_start_date = course["startDate"]
        course_end_date = course["endDate"]

        participations = session.execute(
            select(Participation)
            .where(Participation.courseId == course_id)
            .options(
                selectinload(Participation.responses),
                selectinload(Participation.detailResponses),
            )
        ).scalars().all()

        details = []
        responses = []
        for participation in participations:
            for detail in participation.detailResponses:
                if course_start_date <= detail.createdAt <= course_end_date:
                    details.append(row_to_dict(detail))
            for response in participation.responses:
                responses.append(row_to_dict(response))

        if not details or not responses:
            courses_without_responses += 1
            print(
                "No detail responses or response entries found for course {}".format(
                    course_id
                )
            )
            continue

        df_details = pd.DataFrame(details)
        df_responses = pd.DataFrame(responses)
        df_responses = df_responses[
            [
                "courseId",
                "participantId",
                "firstResponseCorrectness",
                "lastResponseCorrectness",
            ]
        ]

        df_details["course_start_date"] = course_start_date
        df_details["course_end_date"] = course_end_date
        df_details["courseId"] = course_id

        df_details, df_element_instances = compute_correctness(
            session, df_details, verbose
        )

        if df_details is None:
            print(
                f"No participant responses found for {course_start_date} to "
                f"{course_end_date}."
            )
            continue

        df_analytics = aggregate_analytics(df_details, df_responses)

        end_curr_date = datetime.now().strftime("%Y-%m-%d")
        course_end_str = (
            course_end_date.strftime("%Y-%m-%d")
            if hasattr(course_end_date, "strftime")
            else str(course_end_date)[:10]
        )
        timestamp = course_end_str if course_end_str < end_curr_date else end_curr_date
        save_participant_analytics(session, df_analytics, timestamp, "COURSE")

    return courses_without_responses
