from datetime import datetime

from ..analytics_eligibility import AnalyticsEligibilityContext, publish_analytics
from ..research_contribution import (
    contribution_scope_key,
    retain_research_contribution,
)


def save_activity_performance(
    db,
    activity_performance,
    course_id,
    practice_quiz_id=None,
    microlearning_id=None,
    eligibility: AnalyticsEligibilityContext | None = None,
    participant_instances=None,
    activity_type=None,
    activity_id=None,
):
    values = {
        "totalErrorRate": activity_performance.totalErrorRate,
        "totalPartialRate": activity_performance.totalPartialRate,
        "totalCorrectRate": activity_performance.totalCorrectRate,
    }

    if practice_quiz_id is not None:
        values.update(
            {
                "firstErrorRate": activity_performance.firstErrorRate,
                "firstPartialRate": activity_performance.firstPartialRate,
                "firstCorrectRate": activity_performance.firstCorrectRate,
                "lastErrorRate": activity_performance.lastErrorRate,
                "lastPartialRate": activity_performance.lastPartialRate,
                "lastCorrectRate": activity_performance.lastCorrectRate,
            }
        )

        create_values = values.copy()
        create_values["practiceQuiz"] = {"connect": {"id": practice_quiz_id}}
        create_values["course"] = {"connect": {"id": course_id}}
        where_clause = {"practiceQuizId": practice_quiz_id}

    elif microlearning_id is not None:
        create_values = values.copy()
        create_values["microLearning"] = {"connect": {"id": microlearning_id}}
        create_values["course"] = {"connect": {"id": course_id}}
        where_clause = {"microLearningId": microlearning_id}

    else:
        raise ValueError(
            "Either practice_quiz_id or microlearning_id must be provided for activity performance creation/update"
        )

    by_participant = {}
    for stat in participant_instances or []:
        by_participant.setdefault(str(stat["participantId"]), {})[str(stat["instanceId"])] = {
            "trialsCount": stat["trialsCount"],
            "correctCount": stat["correctCount"],
            "partialCorrectCount": stat["partialCorrectCount"],
            "wrongCount": stat["wrongCount"],
            "firstResponseCorrectness": stat["firstResponseCorrectness"],
            "lastResponseCorrectness": stat["lastResponseCorrectness"],
            "averageTimeSpent": stat["averageTimeSpent"],
        }

    def write(transaction):
        result = transaction.activityperformance.upsert(
            where=where_clause,
            data={"create": create_values, "update": values},
        )
        result_id = getattr(result, "id", None)
        for participant_id, instances in by_participant.items():
            retain_research_contribution(
                transaction,
                family="ACTIVITY_PERFORMANCE",
                participant_id=participant_id,
                course_id=course_id,
                scope_key=contribution_scope_key(
                    "ACTIVITY_PERFORMANCE",
                    course_id,
                    practice_quiz_id if practice_quiz_id is not None else microlearning_id,
                ),
                scope={
                    "courseId": course_id,
                    "activityType": activity_type,
                    "activityId": activity_id,
                },
                contributions={"instances": instances},
                eligibility=eligibility,
                computed_at=datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z",
                binding="activityPerformanceId",
                result_row_id=result_id,
            )

    publish_analytics(db, eligibility, (course_id,), write)
