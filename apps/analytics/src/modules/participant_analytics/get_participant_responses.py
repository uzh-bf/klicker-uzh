import pandas as pd
from src.modules.learning_analytics_eligibility import (
    LEARNING_ANALYTICS_DISCLOSURE_VERSION,
    filter_eligible_activity,
    is_learning_analytics_rollout_enabled,
)


def get_participant_responses(db, start_date, end_date, verbose=False):
    if not is_learning_analytics_rollout_enabled():
        return pd.DataFrame()

    participations = db.participation.find_many(
        where={
            "learningAnalyticsStatus": "INCLUDED",
            "learningAnalyticsDisclosureVersion": LEARNING_ANALYTICS_DISCLOSURE_VERSION,
            "learningAnalyticsIncludedFrom": {"not": None},
            "course": {"isLearningAnalyticsEnabled": True},
        },
        include={
            "course": True,
            "detailResponses": {
                "where": {
                    "createdAt": {"gte": start_date, "lte": end_date},
                    "elementInstance": {
                        "elementType": {"not": "FREE_TEXT"},
                    },
                },
                "include": {
                    "practiceQuiz": True,
                    "microLearning": True,
                },
            },
        },
    )

    if verbose:
        # Print the first 5 question response details
        print(
            "Found {} eligible participations for the timespan from {} to {}".format(
                len(participations), start_date, end_date
            )
        )
        if participations:
            print(participations[0])

    details = []
    for participation_model in participations:
        participation = participation_model.dict()
        course = participation["course"]
        eligible_details = filter_eligible_activity(
            participation["detailResponses"],
            participation=participation,
            is_course_enabled=course["isLearningAnalyticsEnabled"],
        )
        for detail in eligible_details:
            if detail["practiceQuiz"] is None and detail["microLearning"] is None:
                continue
            if not (course["startDate"] <= detail["createdAt"] <= course["endDate"]):
                continue
            details.append(
                {
                    **detail,
                    "participantId": participation["participantId"],
                    "courseId": participation["courseId"],
                    "course_start_date": course["startDate"],
                    "course_end_date": course["endDate"],
                }
            )

    return pd.DataFrame(details)
