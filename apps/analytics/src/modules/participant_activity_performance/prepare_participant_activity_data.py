import pandas as pd
from sqlalchemy.orm import Session

from src.modules.eligible_response_details import get_eligible_course_activities
from src.modules.utils import check_analytics_cancellation


def prepare_participant_activity_data(session: Session, course_id: str):
    course, practice_quizzes, micro_learnings = get_eligible_course_activities(
        session,
        course_id,
        activity_statuses=["PUBLISHED", "ENDED", "GRADED"],
    )
    if course is None:
        return pd.DataFrame(), pd.DataFrame(), []

    def _activity_rows(activities, activity_type: str):
        return [
            {
                "id": activity["id"],
                "type": activity_type,
                "instanceCount": sum(len(stack["elements"]) for stack in activity["stacks"]),
            }
            for activity in activities
        ]

    df_activities = pd.DataFrame(
        _activity_rows(practice_quizzes, "practiceQuizzes") + _activity_rows(micro_learnings, "microLearnings")
    )

    responses = []
    for activity in practice_quizzes + micro_learnings:
        check_analytics_cancellation()
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

    participant_ids = [participation["participantId"] for participation in course["participations"]]
    return df_activities, pd.DataFrame(responses), participant_ids
