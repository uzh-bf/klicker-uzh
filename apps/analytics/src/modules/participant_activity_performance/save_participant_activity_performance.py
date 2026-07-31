from sqlalchemy import delete, tuple_
from sqlalchemy.orm import Session

from src.db_helpers import bulk_upsert
from src.models import ParticipantActivityPerformance
from src.modules.learning_analytics_eligibility import (
    filter_learning_analytics_rows_for_write,
)


def save_participant_activity_performance(
    session: Session,
    df_activity_performance,
    activity_type: str,
    course_id: str,
):
    if df_activity_performance is None or df_activity_performance.empty:
        return

    if activity_type == "practiceQuizzes":
        rows = [
            {
                "totalScore": int(row["totalScore"]),
                "completion": float(row["completion"]),
                "participantId": row["participantId"],
                "practiceQuizId": row["activityId"],
                "courseId": course_id,
            }
            for _, row in df_activity_performance.iterrows()
        ]
        conflict_cols = ["participantId", "practiceQuizId"]
    elif activity_type == "microLearnings":
        rows = [
            {
                "totalScore": int(row["totalScore"]),
                "completion": float(row["completion"]),
                "participantId": row["participantId"],
                "microLearningId": row["activityId"],
                "courseId": course_id,
            }
            for _, row in df_activity_performance.iterrows()
        ]
        conflict_cols = ["participantId", "microLearningId"]
    else:
        raise ValueError(f"Unknown activity type: {activity_type}")

    rows = filter_learning_analytics_rows_for_write(
        session,
        rows,
        participant_id_key="participantId",
    )
    if not rows:
        session.rollback()
        return

    activity_id_key = "practiceQuizId" if activity_type == "practiceQuizzes" else "microLearningId"
    activity_column = (
        ParticipantActivityPerformance.practiceQuizId
        if activity_type == "practiceQuizzes"
        else ParticipantActivityPerformance.microLearningId
    )
    activity_ids = sorted({row[activity_id_key] for row in rows})
    target_pairs = {(row["participantId"], row[activity_id_key]) for row in rows}
    session.execute(
        delete(ParticipantActivityPerformance).where(
            activity_column.in_(activity_ids),
            tuple_(
                ParticipantActivityPerformance.participantId,
                activity_column,
            ).notin_(target_pairs),
        )
    )
    for row in rows:
        row.pop("courseId")

    bulk_upsert(
        session,
        ParticipantActivityPerformance,
        rows,
        conflict_cols=conflict_cols,
        update_cols=["totalScore", "completion"],
    )
    session.commit()
