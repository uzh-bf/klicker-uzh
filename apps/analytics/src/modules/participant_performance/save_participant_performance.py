from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    AnalyticsEligibilityRequired,
    filter_dataframe_by_participants,
    publish_analytics,
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
            transaction.participantperformance.upsert(
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

    publish_analytics(db, eligibility, (course_id,), write)
