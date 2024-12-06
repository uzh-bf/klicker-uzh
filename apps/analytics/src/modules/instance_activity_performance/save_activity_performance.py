def save_activity_performance(
    db, activity_performance, course_id, practice_quiz_id=None, microlearning_id=None
):
    data_create = {
        "firstErrorRate": activity_performance.firstErrorRate,
        "firstPartialRate": activity_performance.firstPartialRate,
        "firstCorrectRate": activity_performance.firstCorrectRate,
        "lastErrorRate": activity_performance.lastErrorRate,
        "lastPartialRate": activity_performance.lastPartialRate,
        "lastCorrectRate": activity_performance.lastCorrectRate,
        "totalErrorRate": activity_performance.totalErrorRate,
        "totalPartialRate": activity_performance.totalPartialRate,
        "totalCorrectRate": activity_performance.totalCorrectRate,
        "course": {"connect": {"id": course_id}},
    }

    if practice_quiz_id is not None:
        data_create["practiceQuiz"] = {"connect": {"id": practice_quiz_id}}
        where_clause = {"practiceQuizId": practice_quiz_id}
    elif microlearning_id is not None:
        data_create["microLearning"] = {"connect": {"id": microlearning_id}}
        where_clause = {"microLearningId": microlearning_id}
    else:
        raise ValueError(
            "Either practice_quiz_id or microlearning_id must be provided for activity performance creation/update"
        )

    db.activityperformance.upsert(
        where=where_clause,
        data={
            "create": data_create,
            "update": {
                "firstErrorRate": activity_performance.firstErrorRate,
                "firstPartialRate": activity_performance.firstPartialRate,
                "firstCorrectRate": activity_performance.firstCorrectRate,
                "lastErrorRate": activity_performance.lastErrorRate,
                "lastPartialRate": activity_performance.lastPartialRate,
                "lastCorrectRate": activity_performance.lastCorrectRate,
                "totalErrorRate": activity_performance.totalErrorRate,
                "totalPartialRate": activity_performance.totalPartialRate,
                "totalCorrectRate": activity_performance.totalCorrectRate,
            },
        },
    )
