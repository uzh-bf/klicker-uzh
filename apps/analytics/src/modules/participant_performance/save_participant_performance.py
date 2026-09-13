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


def save_participant_performance(
    db,
    df_performance,
    course_id,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    if df_performance.empty:
        return
    if eligibility is None:
        raise AnalyticsEligibilityRequired("Analytics publication requires an eligibility context")

    df_performance = filter_dataframe_by_participants(df_performance, eligibility)
    if df_performance.empty:
        return

    def write(transaction):
        for _, row in df_performance.iterrows():
            result = transaction.participantperformance.upsert(
                where={
                    "participantId_courseId": {
                        "participantId": row["participantId"],
                        "courseId": course_id,
                    }
                },
                data={
                    "create": {
                        "firstErrorRate": row["firstErrorRate"],
                        "firstPerformance": row["firstPerformance"],
                        "lastErrorRate": row["lastErrorRate"],
                        "lastPerformance": row["lastPerformance"],
                        "totalErrorRate": row["totalErrorRate"],
                        "totalPerformance": row["totalPerformance"],
                        "participant": {"connect": {"id": row["participantId"]}},
                        "course": {"connect": {"id": course_id}},
                    },
                    "update": {
                        "firstErrorRate": row["firstErrorRate"],
                        "firstPerformance": row["firstPerformance"],
                        "lastErrorRate": row["lastErrorRate"],
                        "lastPerformance": row["lastPerformance"],
                        "totalErrorRate": row["totalErrorRate"],
                        "totalPerformance": row["totalPerformance"],
                    },
                },
            )
            # Performance levels are cohort-derived classifications; research
            # exports recompute them from release-eligible rate contributions.
            retain_research_contribution(
                transaction,
                family="PARTICIPANT_PERFORMANCE",
                participant_id=row["participantId"],
                course_id=course_id,
                scope_key=contribution_scope_key(
                    "PARTICIPANT_PERFORMANCE",
                    course_id,
                ),
                scope={"courseId": course_id},
                contributions={
                    "firstErrorRate": row["firstErrorRate"],
                    "lastErrorRate": row["lastErrorRate"],
                    "totalErrorRate": row["totalErrorRate"],
                },
                eligibility=eligibility,
                computed_at=datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z",
                binding="participantPerformanceId",
                result_row_id=getattr(result, "id", None),
            )

    publish_analytics(db, eligibility, (course_id,), write)
