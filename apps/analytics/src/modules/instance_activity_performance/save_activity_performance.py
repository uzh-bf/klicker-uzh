from datetime import datetime

from sqlalchemy.orm import Session

from src.db_helpers import bulk_upsert
from src.models import ActivityPerformance


def save_activity_performance(
    session: Session,
    activity_performance,
    course_id: str,
    practice_quiz_id: str | None = None,
    microlearning_id: str | None = None,
):
    now = datetime.now()
    values = {
        "totalErrorRate": float(activity_performance.totalErrorRate),
        "totalPartialRate": float(activity_performance.totalPartialRate),
        "totalCorrectRate": float(activity_performance.totalCorrectRate),
        "courseId": course_id,
        "createdAt": now,
        "updatedAt": now,
    }

    if practice_quiz_id is not None:
        values.update(
            {
                "firstErrorRate": float(activity_performance.firstErrorRate),
                "firstPartialRate": float(activity_performance.firstPartialRate),
                "firstCorrectRate": float(activity_performance.firstCorrectRate),
                "lastErrorRate": float(activity_performance.lastErrorRate),
                "lastPartialRate": float(activity_performance.lastPartialRate),
                "lastCorrectRate": float(activity_performance.lastCorrectRate),
                "practiceQuizId": practice_quiz_id,
            }
        )
        conflict_col = "practiceQuizId"
    elif microlearning_id is not None:
        values["microLearningId"] = microlearning_id
        conflict_col = "microLearningId"
    else:
        raise ValueError(
            "Either practice_quiz_id or microlearning_id must be provided for "
            "activity performance creation/update"
        )

    update_cols = [c for c in values.keys() if c != conflict_col and c != "createdAt"]
    bulk_upsert(
        session,
        ActivityPerformance,
        [values],
        conflict_cols=[conflict_col],
        update_cols=update_cols,
    )
    session.commit()
