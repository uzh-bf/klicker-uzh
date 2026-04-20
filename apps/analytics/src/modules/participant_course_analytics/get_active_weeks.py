import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.models import ParticipantAnalytics


def get_active_weeks(session: Session, course):
    course_id = course["id"]
    participations = course["participations"]

    df_activity = pd.DataFrame(columns=["participantId", "courseId", "activeWeeks"])

    for participation in participations:
        participant_id = participation["participantId"]
        active_weeks = session.execute(
            select(func.count()).select_from(ParticipantAnalytics).where(
                ParticipantAnalytics.type == "WEEKLY",
                ParticipantAnalytics.courseId == course_id,
                ParticipantAnalytics.participantId == participant_id,
            )
        ).scalar_one()

        df_activity.loc[len(df_activity)] = {
            "participantId": participant_id,
            "courseId": course_id,
            "activeWeeks": active_weeks,
        }

    if not df_activity.empty:
        quantiles = df_activity.activeWeeks.quantile([0.25, 0.75])
        q1 = quantiles[0.25]
        q3 = quantiles[0.75]

        df_activity["activityLevel"] = "MEDIUM"
        df_activity.loc[df_activity.activeWeeks >= q3, "activityLevel"] = "HIGH"
        df_activity.loc[df_activity.activeWeeks <= q1, "activityLevel"] = "LOW"

    return df_activity
