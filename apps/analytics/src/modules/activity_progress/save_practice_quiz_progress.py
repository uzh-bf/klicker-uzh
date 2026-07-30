from src.modules.learning_analytics_eligibility import learning_analytics_write_transaction


def save_practice_quiz_progress(
    db,
    course_participants,
    started_count,
    completed_count,
    repeated_count,
    course_id,
    quiz_id,
):
    values = {
        "totalCourseParticipants": course_participants,
        "startedCount": started_count,
        "completedCount": completed_count,
        "repeatedCount": repeated_count,
    }
    creation_values = values.copy()
    creation_values["course"] = {"connect": {"id": course_id}}
    creation_values["practiceQuiz"] = {"connect": {"id": quiz_id}}

    with learning_analytics_write_transaction(db, course_id=course_id) as transaction:
        if transaction is None:
            return
        transaction.activityprogress.upsert(
            where={"practiceQuizId": quiz_id},
            data={"create": creation_values, "update": values},
        )
