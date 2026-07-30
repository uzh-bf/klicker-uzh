from datetime import datetime

from sqlalchemy import delete, tuple_
from sqlalchemy.orm import Session

from src.db_helpers import bulk_upsert
from src.models import ParticipantCourseAnalytics
from src.modules.learning_analytics_eligibility import (
    filter_learning_analytics_rows_for_write,
)


def save_participant_course_analytics(session: Session, df_activity):
    if df_activity is None or df_activity.empty:
        return

    now = datetime.now()
    rows = [
        {
            "activeWeeks": int(row["activeWeeks"]),
            "activeDaysPerWeek": float(row["activeDaysPerWeek"]),
            "meanElementsPerDay": float(row["meanElementsPerDay"]),
            "activityLevel": row["activityLevel"],
            "courseId": row["courseId"],
            "participantId": row["participantId"],
            "createdAt": now,
            "updatedAt": now,
        }
        for _, row in df_activity.iterrows()
    ]
    rows = filter_learning_analytics_rows_for_write(
        session,
        rows,
        participant_id_key="participantId",
    )
    if not rows:
        session.rollback()
        return

    # Drop-out cleanup: remove stale (courseId, participantId) pairs within the
    # courses in scope that are not part of the fresh target set, then upsert.
    course_ids_in_scope = sorted({r["courseId"] for r in rows})
    target_pairs = {(r["courseId"], r["participantId"]) for r in rows}
    if course_ids_in_scope and target_pairs:
        session.execute(
            delete(ParticipantCourseAnalytics).where(
                ParticipantCourseAnalytics.courseId.in_(course_ids_in_scope),
                tuple_(
                    ParticipantCourseAnalytics.courseId,
                    ParticipantCourseAnalytics.participantId,
                ).notin_(target_pairs),
            )
        )

    bulk_upsert(
        session,
        ParticipantCourseAnalytics,
        rows,
        conflict_cols=["courseId", "participantId"],
        update_cols=[
            "activeWeeks",
            "activeDaysPerWeek",
            "meanElementsPerDay",
            "activityLevel",
            "updatedAt",
        ],
    )
    session.commit()
