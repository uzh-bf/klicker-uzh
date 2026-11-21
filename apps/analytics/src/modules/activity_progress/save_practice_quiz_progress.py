from ..analytics_eligibility import AnalyticsEligibilityContext, publish_analytics


def save_practice_quiz_progress(
    db,
    course_participants,
    started_count,
    completed_count,
    repeated_count,
    course_id,
    quiz_id,
    eligibility: AnalyticsEligibilityContext | None = None,
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

    def write(transaction):
        transaction.activityprogress.upsert(
            where={"practiceQuizId": quiz_id},
            data={"create": creation_values, "update": values},
        )

    publish_analytics(db, eligibility, (course_id,), write)
