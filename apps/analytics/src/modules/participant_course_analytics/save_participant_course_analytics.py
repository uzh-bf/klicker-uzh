from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    AnalyticsEligibilityRequired,
    filter_dataframe_by_participants,
    publish_analytics,
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
            transaction.participantcourseanalytics.upsert(
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

    publish_analytics(db, eligibility, course_ids, write)
