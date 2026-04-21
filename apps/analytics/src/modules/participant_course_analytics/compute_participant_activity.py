import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db_helpers import row_to_dict
from src.dryrun import buffer_registry
from src.models import ParticipantAnalytics


def compute_participant_activity(
    session: Session, df_activity, course_id, course_start, course_end
):
    course_duration = (course_end - course_start).days + 1
    week_end_dates = pd.date_range(start=course_start, end=course_end, freq="W")

    daily_by_participant = _buffered_daily_by_participant(course_id)

    for idx, row in df_activity.iterrows():
        participant_id = row["participantId"]

        if daily_by_participant is not None:
            daily_analytics = daily_by_participant.get(str(participant_id), [])
        else:
            daily_rows = (
                session.execute(
                    select(ParticipantAnalytics).where(
                        ParticipantAnalytics.type == "DAILY",
                        ParticipantAnalytics.courseId == course_id,
                        ParticipantAnalytics.participantId == participant_id,
                    )
                )
                .scalars()
                .all()
            )
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


def _buffered_daily_by_participant(course_id) -> dict[str, list[dict]] | None:
    rows = buffer_registry.filter_rows(
        "ParticipantAnalytics",
        course_ids=[str(course_id)],
        type_value="DAILY",
    )
    if rows is None:
        return None
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        participant_id = str(row.get("participantId"))
        grouped.setdefault(participant_id, []).append(row)
    return grouped


def sum_active_days_per_week(week_end, daily_analytics):
    week_start = pd.Timestamp(week_end) - pd.DateOffset(days=6)
    end_ts = pd.Timestamp(week_end)
    return [
        d
        for d in daily_analytics
        if week_start <= pd.Timestamp(d["timestamp"]) <= end_ts
    ]
