from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.db_helpers import bulk_upsert
from src.models import (
    AggregatedAnalytics,
    Course,
    ElementStack,
    MicroLearning,
    PracticeQuiz,
)


def _count_elements_for_course(session: Session, course_id: str) -> int:
    course = session.execute(
        select(Course)
        .where(Course.id == course_id)
        .options(
            selectinload(Course.practiceQuizzes)
            .selectinload(PracticeQuiz.stacks)
            .selectinload(ElementStack.elements),
            selectinload(Course.microLearnings)
            .selectinload(MicroLearning.stacks)
            .selectinload(ElementStack.elements),
        )
    ).scalar_one()

    total = 0
    for pq in course.practiceQuizzes:
        for stack in pq.stacks:
            total += len(stack.elements)
    for ml in course.microLearnings:
        for stack in ml.stacks:
            total += len(stack.elements)
    return total


def save_aggregated_analytics(
    session: Session, df_analytics, timestamp, analytics_type="DAILY"
):
    if df_analytics is None or df_analytics.empty:
        return

    computedAt = datetime.now().strftime("%Y-%m-%d")

    if analytics_type in ("DAILY", "WEEKLY", "MONTHLY"):
        rows = [
            {
                "type": analytics_type,
                "timestamp": timestamp,
                "computedAt": computedAt,
                "participantCount": int(row["participantCount"]),
                "responseCount": int(row["responseCount"]),
                "totalScore": int(row["totalScore"]),
                "totalPoints": int(row["totalPoints"]),
                "totalXp": int(row["totalXp"]),
                # Cannot be computed for past learning analytics; sentinel value
                # kept from the pre-migration implementation.
                "totalElementsAvailable": -1,
                "courseId": row["courseId"],
                "createdAt": datetime.now(),
                "updatedAt": datetime.now(),
            }
            for _, row in df_analytics.iterrows()
        ]
    elif analytics_type == "COURSE":
        rows = []
        for _, row in df_analytics.iterrows():
            total_elements = _count_elements_for_course(session, row["courseId"])
            rows.append(
                {
                    "type": "COURSE",
                    "timestamp": timestamp,
                    "computedAt": computedAt,
                    "participantCount": int(row["participantCount"]),
                    "responseCount": int(row["responseCount"]),
                    "totalScore": int(row["totalScore"]),
                    "totalPoints": int(row["totalPoints"]),
                    "totalXp": int(row["totalXp"]),
                    "totalElementsAvailable": total_elements,
                    "courseId": row["courseId"],
                    "createdAt": datetime.now(),
                    "updatedAt": datetime.now(),
                }
            )
    else:
        raise ValueError("Unknown analytics type: {}".format(analytics_type))

    bulk_upsert(
        session,
        AggregatedAnalytics,
        rows,
        conflict_cols=["type", "courseId", "timestamp"],
        update_cols=[c for c in rows[0].keys()
                     if c not in ("type", "courseId", "timestamp", "createdAt")],
    )
    session.commit()
