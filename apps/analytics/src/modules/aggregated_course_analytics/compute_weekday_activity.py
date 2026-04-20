import statistics
from datetime import datetime

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db_helpers import bulk_upsert, row_to_dict
from src.models import AggregatedCourseAnalytics, ParticipantAnalytics


def compute_weekday_activity(session: Session, course):
    course_id = course["id"]
    course_start = (
        course["startDate"].date()
        if hasattr(course["startDate"], "date")
        else pd.Timestamp(course["startDate"]).date()
    )
    course_end = (
        course["endDate"].date()
        if hasattr(course["endDate"], "date")
        else pd.Timestamp(course["endDate"]).date()
    )
    total_course_participants = len(course["participations"])

    daily_analytics = (
        session.execute(
            select(ParticipantAnalytics).where(
                ParticipantAnalytics.type == "DAILY",
                ParticipantAnalytics.courseId == course_id,
            )
        )
        .scalars()
        .all()
    )
    df_daily = pd.DataFrame([row_to_dict(daily) for daily in daily_analytics])

    if df_daily.empty:
        return None

    def _weekday_range(freq):
        return pd.date_range(
            start=course_start,
            end=pd.Timestamp(course_end) + pd.tseries.offsets.DateOffset(days=1),
            freq=freq,
        )

    activity_monday = single_weekday_activity(_weekday_range("W-MON"), df_daily)
    activity_tuesday = single_weekday_activity(_weekday_range("W-TUE"), df_daily)
    activity_wednesday = single_weekday_activity(_weekday_range("W-WED"), df_daily)
    activity_thursday = single_weekday_activity(_weekday_range("W-THU"), df_daily)
    activity_friday = single_weekday_activity(_weekday_range("W-FRI"), df_daily)
    activity_saturday = single_weekday_activity(_weekday_range("W-SAT"), df_daily)
    activity_sunday = single_weekday_activity(_weekday_range("W-SUN"), df_daily)

    now = datetime.now()
    row = {
        "courseParticipantCount": int(total_course_participants),
        "activityMonday": float(activity_monday),
        "activityTuesday": float(activity_tuesday),
        "activityWednesday": float(activity_wednesday),
        "activityThursday": float(activity_thursday),
        "activityFriday": float(activity_friday),
        "activitySaturday": float(activity_saturday),
        "activitySunday": float(activity_sunday),
        "courseId": course_id,
        "createdAt": now,
        "updatedAt": now,
    }
    bulk_upsert(
        session,
        AggregatedCourseAnalytics,
        [row],
        conflict_cols=["courseId"],
        update_cols=[c for c in row.keys() if c not in ("courseId", "createdAt")],
    )
    session.commit()


def single_weekday_activity(weekdays, df_daily):
    collector = []
    for weekday in weekdays:
        df_weekday = df_daily[
            df_daily["timestamp"] == pd.Timestamp(weekday).tz_localize("UTC")
        ]
        if df_weekday.empty:
            collector.append(0)
        collector.append(len(df_weekday))

    return statistics.mean(collector) if len(collector) > 0 else 0
