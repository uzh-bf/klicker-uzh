import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db_helpers import row_to_dict
from src.models import ParticipantAnalytics


def compute_participant_activity(
    session: Session, df_activity, course_id, course_start, course_end
):
    course_duration = (course_end - course_start).days + 1
    week_end_dates = pd.date_range(start=course_start, end=course_end, freq="W")

    for idx, row in df_activity.iterrows():
        participant_id = row["participantId"]

        daily_rows = session.execute(
            select(ParticipantAnalytics).where(
                ParticipantAnalytics.type == "DAILY",
                ParticipantAnalytics.courseId == course_id,
                ParticipantAnalytics.participantId == participant_id,
            )
        ).scalars().all()
        daily_analytics = [row_to_dict(d) for d in daily_rows]

        response_count = sum(d["responseCount"] for d in daily_analytics)
        df_activity.loc[idx, "meanElementsPerDay"] = response_count / course_duration

        active_days_week = []

        if course_duration <= 7:
            week_analytics = sum_active_days_per_week(course_end, daily_analytics)
            active_days_week.append(len(week_analytics))
        else:
            for week_end in week_end_dates:
                week_analytics = sum_active_days_per_week(week_end, daily_analytics)
                active_days_week.append(len(week_analytics))

        df_activity.loc[idx, "activeDaysPerWeek"] = sum(active_days_week) / len(
            active_days_week
        )

    return df_activity


def sum_active_days_per_week(week_end, daily_analytics):
    week_start = pd.Timestamp(week_end) - pd.DateOffset(days=6)
    end_ts = pd.Timestamp(week_end)
    return [
        d
        for d in daily_analytics
        if week_start <= pd.Timestamp(d["timestamp"]) <= end_ts
    ]
