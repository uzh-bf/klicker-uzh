from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    ensure_analytics_eligibility,
    filter_activity_by_eligibility,
    is_course_learning_analytics_enabled,
)


def get_course_progress_activities(
    db,
    course_id,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    eligibility = ensure_analytics_eligibility(db, eligibility)
    if not is_course_learning_analytics_enabled(db, course_id):
        return [], []

    pqs = db.practicequiz.find_many(
        where={"courseId": course_id},
        include={"stacks": {"include": {"elements": True}}, "responses": True},
    )
    pqs = [filter_activity_by_eligibility(x.dict(), eligibility) for x in pqs]

    mls = db.microlearning.find_many(
        where={"courseId": course_id},
        include={"stacks": {"include": {"elements": True}}, "responses": True},
    )
    mls = [filter_activity_by_eligibility(x.dict(), eligibility) for x in mls]

    return pqs, mls
