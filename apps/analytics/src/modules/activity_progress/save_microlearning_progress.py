from datetime import datetime

from ..analytics_eligibility import AnalyticsEligibilityContext, publish_analytics
from ..research_contribution import (
    contribution_scope_key,
    retain_research_contribution,
)


def save_microlearning_progress(
    db,
    course_participants,
    started_count,
    completed_count,
    course_id,
    ml_id,
    eligibility: AnalyticsEligibilityContext | None = None,
    participant_stats=None,
):
    values = {
        "totalCourseParticipants": course_participants,
        "startedCount": started_count,
        "completedCount": completed_count,
    }
    creation_values = values.copy()
    creation_values["course"] = {"connect": {"id": course_id}}
    creation_values["microLearning"] = {"connect": {"id": ml_id}}

    def write(transaction):
        result = transaction.activityprogress.upsert(
            where={"microLearningId": ml_id},
            data={"create": creation_values, "update": values},
        )
        result_id = getattr(result, "id", None)
        for stat in participant_stats or []:
            retain_research_contribution(
                transaction,
                family="ACTIVITY_PROGRESS",
                participant_id=stat["participantId"],
                course_id=course_id,
                scope_key=contribution_scope_key(
                    "ACTIVITY_PROGRESS",
                    course_id,
                    "microLearnings",
                    ml_id,
                ),
                scope={
                    "courseId": course_id,
                    "activityType": "microLearnings",
                    "activityId": ml_id,
                    "totalCourseParticipants": course_participants,
                },
                contributions={
                    "responseCount": stat["responseCount"],
                    "minTrials": stat["minTrials"],
                    "started": stat["started"],
                    "completed": stat["completed"],
                },
                eligibility=eligibility,
                computed_at=datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z",
                binding="activityProgressId",
                result_row_id=result_id,
            )

    publish_analytics(db, eligibility, (course_id,), write)
