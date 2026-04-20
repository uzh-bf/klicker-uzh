import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.models import (
    Course,
    ElementInstance,
    ElementStack,
    MicroLearning,
    PracticeQuiz,
)


def prepare_participant_activity_data(session: Session, course_id: str):
    course = session.execute(
        select(Course)
        .where(Course.id == course_id)
        .options(
            selectinload(Course.practiceQuizzes)
            .selectinload(PracticeQuiz.stacks)
            .selectinload(ElementStack.elements)
            .selectinload(ElementInstance.responses),
            selectinload(Course.microLearnings)
            .selectinload(MicroLearning.stacks)
            .selectinload(ElementStack.elements)
            .selectinload(ElementInstance.responses),
            selectinload(Course.participations),
        )
    ).scalar_one_or_none()

    if course is None:
        return pd.DataFrame(), pd.DataFrame(), []

    published_statuses = {"PUBLISHED", "ENDED", "GRADED"}
    practice_quizzes = [
        pq for pq in course.practiceQuizzes if pq.status in published_statuses
    ]
    micro_learnings = [
        ml for ml in course.microLearnings if ml.status in published_statuses
    ]

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

    participant_ids = [p.participantId for p in course.participations]

    responses = []
    for activity in list(practice_quizzes) + list(micro_learnings):
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
