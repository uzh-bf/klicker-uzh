from sqlalchemy import delete, tuple_
from sqlalchemy.orm import Session

from src.db_helpers import bulk_upsert
from src.models import ParticipantActivityPerformance


def save_participant_activity_performance(session: Session, df_activity_performance, activity_type: str):
    if df_activity_performance is None or df_activity_performance.empty:
        return

    if activity_type == "practiceQuizzes":
        rows = [
            {
                "totalScore": int(row["totalScore"]),
                "completion": float(row["completion"]),
                "participantId": row["participantId"],
                "practiceQuizId": row["activityId"],
            }
            for _, row in df_activity_performance.iterrows()
        ]
        conflict_cols = ["participantId", "practiceQuizId"]
        quiz_ids = sorted({r["practiceQuizId"] for r in rows})
        target_pairs = {(r["participantId"], r["practiceQuizId"]) for r in rows}
        if quiz_ids and target_pairs:
            session.execute(
                delete(ParticipantActivityPerformance).where(
                    ParticipantActivityPerformance.practiceQuizId.in_(quiz_ids),
                    tuple_(
                        ParticipantActivityPerformance.participantId,
                        ParticipantActivityPerformance.practiceQuizId,
                    ).notin_(target_pairs),
                )
            )
    elif activity_type == "microLearnings":
        rows = [
            {
                "totalScore": int(row["totalScore"]),
                "completion": float(row["completion"]),
                "participantId": row["participantId"],
                "microLearningId": row["activityId"],
            }
            for _, row in df_activity_performance.iterrows()
        ]
        conflict_cols = ["participantId", "microLearningId"]
        ml_ids = sorted({r["microLearningId"] for r in rows})
        target_pairs = {(r["participantId"], r["microLearningId"]) for r in rows}
        if ml_ids and target_pairs:
            session.execute(
                delete(ParticipantActivityPerformance).where(
                    ParticipantActivityPerformance.microLearningId.in_(ml_ids),
                    tuple_(
                        ParticipantActivityPerformance.participantId,
                        ParticipantActivityPerformance.microLearningId,
                    ).notin_(target_pairs),
                )
            )
    else:
        raise ValueError(f"Unknown activity type: {activity_type}")

    bulk_upsert(
        session,
        ParticipantActivityPerformance,
        rows,
        conflict_cols=conflict_cols,
        update_cols=["totalScore", "completion"],
    )
    session.commit()
