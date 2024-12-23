def save_microlearning_progress(
    db,
    course_participants,
    started_count,
    completed_count,
    course_id,
    ml_id,
):
    values = {
        "totalCourseParticipants": course_participants,
        "startedCount": started_count,
        "completedCount": completed_count,
    }
    creation_values = values.copy()
    creation_values["course"] = {"connect": {"id": course_id}}
    creation_values["microLearning"] = {"connect": {"id": ml_id}}

    db.activityprogress.upsert(
        where={"microLearningId": ml_id},
        data={"create": creation_values, "update": values},
    )
