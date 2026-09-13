import pandas as pd

from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    ensure_analytics_eligibility,
    filter_activity_by_eligibility,
)


_ACTIVITY_COLUMNS = ["id", "type", "instanceCount"]
_RESPONSE_COLUMNS = [
    "activityId",
    "participantId",
    "elementId",
    "totalScore",
    "trialsCount",
    "createdAt",
]


def _empty_activity_data():
    return (
        pd.DataFrame(columns=_ACTIVITY_COLUMNS),
        pd.DataFrame(columns=_RESPONSE_COLUMNS),
        [],
    )


def prepare_participant_activity_data(
    db,
    course_id: str,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    eligibility = ensure_analytics_eligibility(db, eligibility)
    if not eligibility.participant_ids:
        return _empty_activity_data()

    # fetch all asynchronous activities in the course alongside their question responses
    course = db.course.find_first(
        where={
            "id": course_id,
            "isLearningAnalyticsEnabled": True,
        },
        include={
            "practiceQuizzes": {
                "where": {"status": {"in": ["PUBLISHED", "ENDED", "GRADED"]}},
                "include": {"stacks": {"include": {"elements": {"include": {"responses": True}}}}},
            },
            "microLearnings": {
                "where": {"status": {"in": ["PUBLISHED", "ENDED", "GRADED"]}},
                "include": {"stacks": {"include": {"elements": {"include": {"responses": True}}}}},
            },
            "participations": {
                "where": {"participantId": {"in": list(eligibility.participant_ids)}},
                "include": {"participant": True},
            },
        },
    )

    if course is None:
        return _empty_activity_data()

    # convert prisma object to python dictionary
    course_dict = course.dict()
    course_dict["practiceQuizzes"] = [
        filter_activity_by_eligibility(activity, eligibility) for activity in course_dict["practiceQuizzes"]
    ]
    course_dict["microLearnings"] = [
        filter_activity_by_eligibility(activity, eligibility) for activity in course_dict["microLearnings"]
    ]

    # combine the activities into a single dataframe for easier processing
    activity_rows = []
    for activity_type in ["practiceQuizzes", "microLearnings"]:
        for activity in course_dict[activity_type]:
            activity_rows.append(
                {
                    "id": activity["id"],
                    "type": activity_type,
                    "instanceCount": sum(len(stack["elements"]) for stack in activity["stacks"]),
                }
            )
    df_activities = pd.DataFrame(activity_rows, columns=_ACTIVITY_COLUMNS)

    # get a list of all eligible participant ids in the course
    eligible_participant_ids = set(eligibility.participant_ids)
    participant_ids = [
        participation["participantId"]
        for participation in course_dict["participations"]
        if participation["participantId"] in eligible_participant_ids
    ]

    # extract all eligible responses and add the activityId as a column, drop the stackId
    responses = []
    for activity in course_dict["practiceQuizzes"] + course_dict["microLearnings"]:
        for stack in activity["stacks"]:
            for element in stack["elements"]:
                for response in element["responses"]:
                    responses.append(
                        {
                            "activityId": activity["id"],
                            "participantId": response["participantId"],
                            "elementId": element["id"],
                            "totalScore": response["totalScore"],
                            "trialsCount": response["trialsCount"],
                            "createdAt": response["createdAt"],
                        }
                    )
    df_responses = pd.DataFrame(responses, columns=_RESPONSE_COLUMNS)

    return df_activities, df_responses, participant_ids
