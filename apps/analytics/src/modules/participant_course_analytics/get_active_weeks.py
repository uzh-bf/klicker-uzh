import pandas as pd

from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    ensure_analytics_eligibility,
    is_course_learning_analytics_enabled,
)


def get_active_weeks(
    db,
    course,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    eligibility = ensure_analytics_eligibility(db, eligibility)
    course_id = course["id"]
    if not is_course_learning_analytics_enabled(db, course_id):
        return pd.DataFrame(columns=["participantId", "courseId", "activeWeeks"])

    participations = [
        participation
        for participation in course["participations"]
        if participation["participantId"] in eligibility.participant_ids
    ]

    if not participations:
        return pd.DataFrame(columns=["participantId", "courseId", "activeWeeks"])

    # initialize pandas dataframe to store the participant activity
    df_activity = pd.DataFrame(columns=["participantId", "courseId", "activeWeeks"])

    # iterate over all participants in the course and count the number of weekly participant analytics entries
    for participation in participations:
        participant_id = participation["participantId"]
        weekly_analytics = db.participantanalytics.find_many(
            where={
                "type": "WEEKLY",
                "courseId": course_id,
                "participantId": participant_id,
            },
        )

        active_weeks = len(weekly_analytics)

        # store data in the dataframe
        df_activity.loc[len(df_activity)] = {
            "participantId": participant_id,
            "courseId": course_id,
            "activeWeeks": active_weeks,
        }

    if not df_activity.empty:
        # compute quantiles based on active weeks
        quantiles = df_activity.activeWeeks.quantile([0.25, 0.75])
        q1 = quantiles[0.25]
        q3 = quantiles[0.75]

        # set activity level based on active weeks
        df_activity["activityLevel"] = "MEDIUM"
        df_activity.loc[df_activity.activeWeeks >= q3, "activityLevel"] = "HIGH"
        df_activity.loc[df_activity.activeWeeks <= q1, "activityLevel"] = "LOW"

    return df_activity
