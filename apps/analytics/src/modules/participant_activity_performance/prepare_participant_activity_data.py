import pandas as pd
from src.modules.eligible_response_details import get_eligible_course_activities


def prepare_participant_activity_data(db, course_id: str):
    course_dict, practice_quizzes, microlearnings = get_eligible_course_activities(
        db,
        course_id,
        activity_statuses=["PUBLISHED", "ENDED", "GRADED"],
    )
    if course_dict is None:
        return pd.DataFrame(), pd.DataFrame(), []

    # combine the activities into a single dataframe for easier processing
    df_activities = pd.concat(
        [
            pd.DataFrame(
                [
                    {
                        "id": activity["id"],
                        "type": activity_type,
                        "instanceCount": sum(len(stack["elements"]) for stack in activity["stacks"]),
                    }
                    for activity in course_dict[activity_type]
                ]
            )
            for activity_type in ["practiceQuizzes", "microLearnings"]
        ],
        ignore_index=True,
    )

    # get a list of all participant ids
    participant_ids = [p["participantId"] for p in course_dict["participations"]]

    # extract a list of all responses and add the activityId as a column, drop the stackId
    responses = []
    for activity in practice_quizzes + microlearnings:
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
                        }
                    )
    df_responses = pd.DataFrame(responses)

    return df_activities, df_responses, participant_ids
