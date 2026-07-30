from src.modules.learning_analytics_eligibility import learning_analytics_write_transaction


def save_activity_performance(db, activity_performance, course_id, practice_quiz_id=None, microlearning_id=None):
    values = {
        "participantCount": activity_performance.participantCount,
        "totalErrorRate": activity_performance.totalErrorRate,
        "totalPartialRate": activity_performance.totalPartialRate,
        "totalCorrectRate": activity_performance.totalCorrectRate,
    }

    if practice_quiz_id is not None:
        values.update(
            {
                "firstErrorRate": activity_performance.firstErrorRate,
                "firstPartialRate": activity_performance.firstPartialRate,
                "firstCorrectRate": activity_performance.firstCorrectRate,
                "lastErrorRate": activity_performance.lastErrorRate,
                "lastPartialRate": activity_performance.lastPartialRate,
                "lastCorrectRate": activity_performance.lastCorrectRate,
            }
        )

        create_values = values.copy()
        create_values["practiceQuiz"] = {"connect": {"id": practice_quiz_id}}
        create_values["course"] = {"connect": {"id": course_id}}
        where_clause = {"practiceQuizId": practice_quiz_id}

    elif microlearning_id is not None:
        create_values = values.copy()
        create_values["microLearning"] = {"connect": {"id": microlearning_id}}
        create_values["course"] = {"connect": {"id": course_id}}
        where_clause = {"microLearningId": microlearning_id}

    else:
        raise ValueError(
            "Either practice_quiz_id or microlearning_id must be provided for activity performance creation/update"
        )

    with learning_analytics_write_transaction(db, course_id=course_id) as transaction:
        if transaction is None:
            return
        transaction.activityperformance.upsert(
            where=where_clause,
            data={"create": create_values, "update": values},
        )
