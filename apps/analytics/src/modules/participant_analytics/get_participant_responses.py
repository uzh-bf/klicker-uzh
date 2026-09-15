import pandas as pd
from datetime import date

from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    ensure_analytics_eligibility,
    filter_records_by_eligibility,
)


def map_details(detail, participantId):
    activity = detail["practiceQuiz"] or detail["microLearning"]
    course = activity["course"] if activity is not None else None
    courseId = activity["courseId"] if activity is not None else None
    return {
        **detail,
        "participantId": participantId,
        "courseId": courseId,
        "courseLearningAnalyticsEnabled": bool(course is not None and course.get("isLearningAnalyticsEnabled", False)),
    }


def map_participants(participant):
    participant_dict = participant.dict()
    return list(
        map(
            lambda detail: map_details(detail, participant_dict["id"]),
            participant_dict["detailQuestionResponses"],
        )
    )


def convert_to_df(participants):
    return pd.DataFrame([item for sublist in list(map(map_participants, participants)) for item in sublist])


# Add the course start and end date to the dataframe for filtering of question response details later on
def set_course_dates(detail):
    if detail["practiceQuiz"] is not None:
        course = detail["practiceQuiz"]["course"]
        detail["course_start_date"] = course["startDate"]
        detail["course_end_date"] = course["endDate"]
    elif detail["microLearning"] is not None:
        course = detail["microLearning"]["course"]
        detail["course_start_date"] = course["startDate"]
        detail["course_end_date"] = course["endDate"]
    else:
        # If the instance is not part of a practice quiz or microlearning, set the start date far into the future -> no analytics should be computed
        detail["course_start_date"] = date(9999, 12, 31)
        detail["course_end_date"] = date(9999, 12, 31)

    return detail


def get_participant_responses(
    db,
    start_date,
    end_date,
    verbose=False,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    eligibility = ensure_analytics_eligibility(db, eligibility)
    if not eligibility.participant_ids:
        return pd.DataFrame()

    participant_response_details = db.participant.find_many(
        where={"id": {"in": list(eligibility.participant_ids)}},
        include={
            "detailQuestionResponses": {
                "where": {"createdAt": {"gte": start_date, "lte": end_date}},
                "include": {
                    "practiceQuiz": {"include": {"course": True}},
                    "microLearning": {"include": {"course": True}},
                },
            },
        },
    )

    if verbose:
        # Print the first 5 question response details
        print(
            "Found {} participants for the timespan from {} to {}".format(
                len(participant_response_details), start_date, end_date
            )
        )
        if participant_response_details:
            print(participant_response_details[0])

    details = [detail for participant in participant_response_details for detail in map_participants(participant)]
    details = [
        detail
        for detail in filter_records_by_eligibility(details, eligibility)
        if detail["courseLearningAnalyticsEnabled"]
    ]
    df_details = pd.DataFrame(details)

    # Filter out the question response details that are not within the course dates and do not consider them for the analysis
    if verbose:
        print(
            "Number of question response details before course date filtering:",
            len(df_details),
        )

    if df_details.empty:
        return df_details

    df_details = df_details.apply(set_course_dates, axis=1)

    if len(df_details) > 0:
        df_details = df_details[
            (df_details["createdAt"] >= df_details["course_start_date"])
            & (df_details["createdAt"] <= df_details["course_end_date"])
        ]

    return df_details
