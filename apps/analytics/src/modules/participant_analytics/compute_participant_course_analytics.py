import pandas as pd
from datetime import datetime
from .compute_correctness import compute_correctness
from .aggregate_analytics import aggregate_analytics
from .save_participant_analytics import save_participant_analytics
from src.modules.learning_analytics_eligibility import (
    LEARNING_ANALYTICS_DISCLOSURE_VERSION,
    filter_eligible_activity,
)


def compute_participant_course_analytics(db, df_courses, verbose=False):
    # Count failure cases
    courses_without_responses = 0

    for idx, course in df_courses.iterrows():
        print(f"Computing participant analytics for course {idx} out of {len(df_courses)}")
        course_id = course["id"]
        course_start_date = course["startDate"]
        course_end_date = course["endDate"]

        # Find currently included participations and filter each detail response
        # against that participation's prospective inclusion boundary.
        participations = db.participation.find_many(
            where={
                "courseId": course_id,
                "learningAnalyticsStatus": "INCLUDED",
                "learningAnalyticsDisclosureVersion": LEARNING_ANALYTICS_DISCLOSURE_VERSION,
                "learningAnalyticsIncludedFrom": {"not": None},
            },
            include={
                "detailResponses": {
                    "where": {
                        "createdAt": {
                            "gte": course_start_date,
                            "lte": course_end_date,
                        },
                        "elementInstance": {
                            "elementType": {"not": "FREE_TEXT"},
                        },
                    },
                },
            },
        )

        details = []
        for participation_model in participations:
            participation = participation_model.dict()
            details.extend(
                {
                    **detail,
                    "participantId": participation["participantId"],
                    "courseId": course_id,
                }
                for detail in filter_eligible_activity(
                    participation["detailResponses"],
                    participation=participation,
                    is_course_enabled=True,
                )
            )
        if len(details) == 0:
            courses_without_responses += 1
            print("No eligible detail responses found for course {}".format(course_id))
            continue

        # Create a pandas dataframe containing eligible response details.
        df_details = pd.DataFrame(details)

        # Add the course start and end dates to the dataframe
        df_details["course_start_date"] = course_start_date
        df_details["course_end_date"] = course_end_date
        df_details["courseId"] = course_id

        # Compute the correctness of each question response detail
        df_details, df_element_instances = compute_correctness(db, df_details, verbose)

        if df_details is None:
            print(f"No participant responses found for {course_start_date} to {course_end_date}.")
            del df_details
            del df_element_instances
            continue

        # Compute participant analytics (score/xp counts and correctness statistics)
        df_analytics = aggregate_analytics(df_details, include_first_last=True)

        # Save the aggreagted analytics into the database
        end_curr_date = datetime.now().strftime("%Y-%m-%d") + "T23:59:59.999Z"
        course_end_date_ext = course_end_date.strftime("%Y-%m-%d") + "T23:59:59.999Z"
        timestamp = course_end_date_ext if course_end_date_ext < end_curr_date else end_curr_date
        save_participant_analytics(db, df_analytics, timestamp, "COURSE")

        # Delete the dataframes to avoid conflicts in the next iteration
        del df_details
        del df_element_instances
        del df_analytics

    return courses_without_responses
