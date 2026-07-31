from datetime import datetime

from sqlalchemy.orm import Session

from src.db_helpers import bulk_upsert
from src.models import ActivityProgress


def save_practice_quiz_progress(
    session: Session,
    course_participants: int,
    started_count: int,
    completed_count: int,
    repeated_count: int,
    course_id: str,
    quiz_id: str,
):
    now = datetime.now()
    row = {
        "totalCourseParticipants": int(course_participants),
        "startedCount": int(started_count),
        "completedCount": int(completed_count),
        "repeatedCount": int(repeated_count),
        "practiceQuizId": quiz_id,
        "courseId": course_id,
        "createdAt": now,
        "updatedAt": now,
    }
    bulk_upsert(
        session,
        ActivityProgress,
        [row],
        conflict_cols=["practiceQuizId"],
        update_cols=[
            "totalCourseParticipants",
            "startedCount",
            "completedCount",
            "repeatedCount",
            "courseId",
            "updatedAt",
        ],
    )
    session.commit()
