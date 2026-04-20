from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.db_helpers import row_to_dict
from src.models import ElementInstance, ElementStack, MicroLearning, PracticeQuiz


def _activity_to_dict(activity) -> dict:
    base = row_to_dict(activity)
    base["stacks"] = []
    for stack in getattr(activity, "stacks", []) or []:
        stack_dict = row_to_dict(stack)
        stack_dict["elements"] = []
        for element in stack.elements:
            element_dict = row_to_dict(element)
            element_dict["responses"] = [row_to_dict(r) for r in element.responses]
            stack_dict["elements"].append(element_dict)
        base["stacks"].append(stack_dict)
    return base


def get_course_activities(session: Session, course_id: str):
    pqs = session.execute(
        select(PracticeQuiz)
        .where(PracticeQuiz.courseId == course_id)
        .options(
            selectinload(PracticeQuiz.stacks)
            .selectinload(ElementStack.elements)
            .selectinload(ElementInstance.responses)
        )
    ).scalars().all()

    mls = session.execute(
        select(MicroLearning)
        .where(MicroLearning.courseId == course_id)
        .options(
            selectinload(MicroLearning.stacks)
            .selectinload(ElementStack.elements)
            .selectinload(ElementInstance.responses)
        )
    ).scalars().all()

    return (
        [_activity_to_dict(q) for q in pqs],
        [_activity_to_dict(ml) for ml in mls],
    )
