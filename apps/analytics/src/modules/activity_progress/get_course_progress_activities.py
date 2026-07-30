from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.db_helpers import row_to_dict
from src.models import ElementStack, MicroLearning, PracticeQuiz


def _quiz_to_dict(quiz) -> dict:
    base = row_to_dict(quiz)
    base["stacks"] = []
    base["responses"] = []
    for stack in getattr(quiz, "stacks", []) or []:
        stack_dict = row_to_dict(stack)
        stack_dict["elements"] = [row_to_dict(e) for e in stack.elements]
        base["stacks"].append(stack_dict)
    for response in getattr(quiz, "responses", []) or []:
        base["responses"].append(row_to_dict(response))
    return base


def get_course_progress_activities(session: Session, course_id: str):
    pqs = (
        session.execute(
            select(PracticeQuiz)
            .where(PracticeQuiz.courseId == course_id)
            .options(
                selectinload(PracticeQuiz.stacks).selectinload(ElementStack.elements),
                selectinload(PracticeQuiz.responses),
            )
        )
        .scalars()
        .all()
    )
    pqs_list = [_quiz_to_dict(q) for q in pqs]

    mls = (
        session.execute(
            select(MicroLearning)
            .where(MicroLearning.courseId == course_id)
            .options(
                selectinload(MicroLearning.stacks).selectinload(ElementStack.elements),
                selectinload(MicroLearning.responses),
            )
        )
        .scalars()
        .all()
    )
    mls_list = [_quiz_to_dict(ml) for ml in mls]

    return pqs_list, mls_list
