from datetime import datetime

from ..analytics_eligibility import AnalyticsEligibilityContext, publish_analytics
from ..research_contribution import (
    contribution_scope_key,
    retain_research_contribution,
)


def save_instance_performances(
    db,
    df_instance_performance,
    course_id,
    total_only=False,
    eligibility: AnalyticsEligibilityContext | None = None,
    participant_instances=None,
    activity_type=None,
    activity_id=None,
):
    if df_instance_performance.empty:
        return

    computedAt = datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z"
    by_instance = {}
    for stat in participant_instances or []:
        by_instance.setdefault(str(stat["instanceId"]), []).append(stat)

    def write(transaction):
        for _, row in df_instance_performance.iterrows():
            # extract values from dataframe
            values = {
                "responseCount": row["responseCount"],
                "totalErrorRate": row["totalErrorRate"],
                "totalPartialRate": row["totalPartialRate"],
                "totalCorrectRate": row["totalCorrectRate"],
                "averageTimeSpent": row["averageTimeSpent"],
            }

            # only define first and last response rates if applicable
            if not total_only:
                values.update(
                    {
                        "firstErrorRate": row["firstErrorRate"],
                        "firstPartialRate": row["firstPartialRate"],
                        "firstCorrectRate": row["firstCorrectRate"],
                        "lastErrorRate": row["lastErrorRate"],
                        "lastPartialRate": row["lastPartialRate"],
                        "lastCorrectRate": row["lastCorrectRate"],
                    }
                )

            # add relational links during creation
            create_values = values.copy()
            create_values.update(
                {
                    "instance": {"connect": {"id": row["instanceId"]}},
                    "course": {"connect": {"id": course_id}},
                }
            )

            result = transaction.instanceperformance.upsert(
                where={
                    "instanceId": row["instanceId"],
                },
                data={
                    "create": create_values,
                    "update": values,
                },
            )
            result_id = getattr(result, "id", None)
            for stat in by_instance.get(str(row["instanceId"]), []):
                retain_research_contribution(
                    transaction,
                    family="INSTANCE_PERFORMANCE",
                    participant_id=stat["participantId"],
                    course_id=course_id,
                    scope_key=contribution_scope_key(
                        "INSTANCE_PERFORMANCE",
                        course_id,
                        row["instanceId"],
                    ),
                    scope={
                        "courseId": course_id,
                        "instanceId": row["instanceId"],
                        "activityType": activity_type,
                        "activityId": activity_id,
                        "totalOnly": total_only,
                    },
                    contributions={
                        "trialsCount": stat["trialsCount"],
                        "correctCount": stat["correctCount"],
                        "partialCorrectCount": stat["partialCorrectCount"],
                        "wrongCount": stat["wrongCount"],
                        "firstResponseCorrectness": stat["firstResponseCorrectness"],
                        "lastResponseCorrectness": stat["lastResponseCorrectness"],
                        "averageTimeSpent": stat["averageTimeSpent"],
                    },
                    eligibility=eligibility,
                    computed_at=computedAt,
                    binding="instancePerformanceId",
                    result_row_id=result_id,
                )

    publish_analytics(db, eligibility, (course_id,), write)
