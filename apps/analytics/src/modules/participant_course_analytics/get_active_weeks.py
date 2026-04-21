import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.dryrun import buffer_registry
from src.models import ParticipantAnalytics


def get_active_weeks(session: Session, course):
    course_id = course["id"]
    participations = course["participations"]

    df_activity = pd.DataFrame(columns=["participantId", "courseId", "activeWeeks"])

    weekly_counts_by_participant = _buffered_weekly_counts(course_id)

    for participation in participations:
        participant_id = participation["participantId"]
        if weekly_counts_by_participant is not None:
            active_weeks = weekly_counts_by_participant.get(str(participant_id), 0)
        else:
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


def _buffered_weekly_counts(course_id) -> dict[str, int] | None:
    rows = buffer_registry.filter_rows(
        "ParticipantAnalytics",
        course_ids=[str(course_id)],
        type_value="WEEKLY",
    )
    if rows is None:
        return None
    counts: dict[str, int] = {}
    for row in rows:
        participant_id = str(row.get("participantId"))
        counts[participant_id] = counts.get(participant_id, 0) + 1
    return counts
