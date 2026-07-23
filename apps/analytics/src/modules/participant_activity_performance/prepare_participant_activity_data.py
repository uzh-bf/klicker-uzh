import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.models import (
    ElementInstance,
    ElementStack,
    MicroLearning,
    Participation,
    PracticeQuiz,
)
from src.modules.utils import check_analytics_cancellation


def prepare_participant_activity_data(session: Session, course_id: str):
    practice_quizzes = session.execute(
        select(PracticeQuiz)
        .where(PracticeQuiz.courseId == course_id)
        .options(
            selectinload(PracticeQuiz.stacks)
            .selectinload(ElementStack.elements)
            .selectinload(ElementInstance.responses)
        )
    ).scalars().all()
    micro_learnings = session.execute(
        select(MicroLearning)
        .where(MicroLearning.courseId == course_id)
        .options(
            selectinload(MicroLearning.stacks)
            .selectinload(ElementStack.elements)
            .selectinload(ElementInstance.responses)
        )
    ).scalars().all()
    participant_ids = session.execute(
        select(Participation.participantId).where(Participation.courseId == course_id)
    ).scalars().all()

    published_statuses = {"PUBLISHED", "ENDED", "GRADED"}
    practice_quizzes = [pq for pq in practice_quizzes if pq.status in published_statuses]
    micro_learnings = [ml for ml in micro_learnings if ml.status in published_statuses]

    def _activity_rows(activities, activity_type: str):
        return [
            {
                "id": activity.id,
                "type": activity_type,
                "instanceCount": sum(
                    len(stack.elements) for stack in activity.stacks
                ),
            }
            for activity in activities
        ]

    df_activities = pd.DataFrame(
        _activity_rows(practice_quizzes, "practiceQuizzes")
        + _activity_rows(micro_learnings, "microLearnings")
    )

    responses = []
    for activity in list(practice_quizzes) + list(micro_learnings):
        check_analytics_cancellation()
        for stack in activity.stacks:
            for element in stack.elements:
                for response in element.responses:
                    responses.append(
                        {
                            "activityId": activity.id,
                            "participantId": response.participantId,
                            "elementId": element.id,
                            "totalScore": response.totalScore,
                            "trialsCount": response.trialsCount,
                        }
                    )
    df_responses = pd.DataFrame(responses)

    return df_activities, df_responses, participant_ids
