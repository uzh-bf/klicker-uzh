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


def save_participant_course_analytics(
    db,
    df_activity,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    if df_activity.empty:
        return
    if eligibility is None:
        raise AnalyticsEligibilityRequired("Analytics publication requires an eligibility context")

    df_activity = filter_dataframe_by_participants(df_activity, eligibility)
    if df_activity.empty:
        return

    course_ids = tuple(dict.fromkeys(str(course_id) for course_id in df_activity["courseId"].dropna()))

    def write(transaction):
        for _, row in df_activity.iterrows():
            result = transaction.participantcourseanalytics.upsert(
                where={
                    "courseId_participantId": {
                        "courseId": row["courseId"],
                        "participantId": row["participantId"],
                    }
                },
                data={
                    "create": {
                        "activeWeeks": row["activeWeeks"],
                        "activeDaysPerWeek": row["activeDaysPerWeek"],
                        "meanElementsPerDay": row["meanElementsPerDay"],
                        "activityLevel": row["activityLevel"],
                        "course": {"connect": {"id": row["courseId"]}},
                        "participant": {"connect": {"id": row["participantId"]}},
                    },
                    "update": {
                        "activeWeeks": row["activeWeeks"],
                        "activeDaysPerWeek": row["activeDaysPerWeek"],
                        "meanElementsPerDay": row["meanElementsPerDay"],
                        "activityLevel": row["activityLevel"],
                    },
                },
            )
            retain_research_contribution(
                transaction,
                family="PARTICIPANT_COURSE_ANALYTICS",
                participant_id=row["participantId"],
                course_id=row["courseId"],
                scope_key=contribution_scope_key(
                    "PARTICIPANT_COURSE_ANALYTICS",
                    row["courseId"],
                ),
                scope={"courseId": row["courseId"]},
                contributions={
                    "activeWeeks": row["activeWeeks"],
                    "activeDaysPerWeek": row["activeDaysPerWeek"],
                    "meanElementsPerDay": row["meanElementsPerDay"],
                },
                eligibility=eligibility,
                computed_at=datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z",
                binding="participantCourseAnalyticsId",
                result_row_id=getattr(result, "id", None),
            )

    publish_analytics(db, eligibility, course_ids, write)
