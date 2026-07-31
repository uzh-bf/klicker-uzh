from sqlalchemy.orm import Session

from src.modules.eligible_response_details import get_eligible_course_activities


def get_course_activities(session: Session, course_id: str):
    _, practice_quizzes, micro_learnings = get_eligible_course_activities(
        session,
        course_id,
    )
    return practice_quizzes, micro_learnings
