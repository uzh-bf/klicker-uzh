from datetime import datetime

from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    AnalyticsEligibilityRequired,
    filter_dataframe_by_participants,
    publish_analytics,
)
from ..research_contribution import (
    contribution_scope_key,
    retain_research_contribution,
)


def save_participant_activity_performance(
    db,
    df_activity_performance,
    activity_type,
    course_id=None,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    if df_activity_performance.empty:
        return
    if course_id is None:
        raise ValueError("course_id is required for participant activity publication")
    if eligibility is None:
        raise AnalyticsEligibilityRequired("Analytics publication requires an eligibility context")

    df_activity_performance = filter_dataframe_by_participants(
        df_activity_performance,
        eligibility,
    )
    if df_activity_performance.empty:
        return

    def write(transaction):
        for _, row in df_activity_performance.iterrows():
            result = None
            creation_values = {
                "totalScore": row["totalScore"],
                "completion": row["completion"],
                "participant": {"connect": {"id": row["participantId"]}},
            }
            update_values = {
                "totalScore": row["totalScore"],
                "completion": row["completion"],
            }

            if activity_type == "practiceQuizzes":
                creation_values["practiceQuiz"] = {"connect": {"id": row["activityId"]}}
                result = transaction.participantactivityperformance.upsert(
                    where={
                        "participantId_practiceQuizId": {
                            "participantId": row["participantId"],
                            "practiceQuizId": row["activityId"],
                        }
                    },
                    data={"create": creation_values, "update": update_values},
                )

            elif activity_type == "microLearnings":
                creation_values["microLearning"] = {"connect": {"id": row["activityId"]}}
                result = transaction.participantactivityperformance.upsert(
                    where={
                        "participantId_microLearningId": {
                            "participantId": row["participantId"],
                            "microLearningId": row["activityId"],
                        }
                    },
                    data={"create": creation_values, "update": update_values},
                )

            else:
                raise ValueError("Unknown activity type: {}".format(activity_type))

            retain_research_contribution(
                transaction,
                family="PARTICIPANT_ACTIVITY_PERFORMANCE",
                participant_id=row["participantId"],
                course_id=course_id,
                scope_key=contribution_scope_key(
                    "PARTICIPANT_ACTIVITY_PERFORMANCE",
                    course_id,
                    activity_type,
                    row["activityId"],
                ),
                scope={
                    "courseId": course_id,
                    "activityType": activity_type,
                    "activityId": row["activityId"],
                },
                contributions={
                    "totalScore": row["totalScore"],
                    "completion": row["completion"],
                },
                eligibility=eligibility,
                computed_at=datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z",
                binding="participantActivityPerformanceId",
                result_row_id=getattr(result, "id", None),
            )

    publish_analytics(db, eligibility, (course_id,), write)
