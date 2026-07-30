from src.modules.eligible_response_details import get_eligible_course_activities


def get_course_progress_activities(db, course_id):
    _, pqs, mls = get_eligible_course_activities(db, course_id)
    return pqs, mls
