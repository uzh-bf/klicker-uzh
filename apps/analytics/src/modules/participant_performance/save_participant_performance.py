from datetime import datetime

from sqlalchemy import delete, tuple_
from sqlalchemy.orm import Session

from src.db_helpers import bulk_upsert
from src.models import ParticipantPerformance
from src.modules.learning_analytics_eligibility import (
    filter_learning_analytics_rows_for_write,
)


def save_participant_performance(session: Session, df_performance, course_id: str):
    if df_performance is None or df_performance.empty:
        return

    now = datetime.now()
    rows = [
        {
            "firstErrorRate": float(row["firstErrorRate"]),
            "firstPerformance": row["firstPerformance"],
            "lastErrorRate": float(row["lastErrorRate"]),
            "lastPerformance": row["lastPerformance"],
            "totalErrorRate": float(row["totalErrorRate"]),
            "totalPerformance": row["totalPerformance"],
            "participantId": row["participantId"],
            "courseId": course_id,
            "createdAt": now,
            "updatedAt": now,
        }
        for _, row in df_performance.iterrows()
    ]
    rows = filter_learning_analytics_rows_for_write(
        session,
        rows,
        participant_id_key="participantId",
    )
    if not rows:
        session.rollback()
        return

    target_pairs = {(r["participantId"], r["courseId"]) for r in rows}
    if target_pairs:
        session.execute(
            delete(ParticipantPerformance).where(
                ParticipantPerformance.courseId == course_id,
                tuple_(
                    ParticipantPerformance.participantId,
                    ParticipantPerformance.courseId,
                ).notin_(target_pairs),
            )
        )

    bulk_upsert(
        session,
        ParticipantPerformance,
        rows,
        conflict_cols=["participantId", "courseId"],
        update_cols=[
            "firstErrorRate",
            "firstPerformance",
            "lastErrorRate",
            "lastPerformance",
            "totalErrorRate",
            "totalPerformance",
            "updatedAt",
        ],
    )
    session.commit()
