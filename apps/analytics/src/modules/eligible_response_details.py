from collections import defaultdict
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from src.db_helpers import row_to_dict
from src.models import (
    Course,
    ElementStack,
    MicroLearning,
    Participation,
    PracticeQuiz,
    QuestionResponseDetail,
)
from src.modules.learning_analytics_eligibility import (
    current_participation_predicates,
    is_activity_eligible_for_learning_analytics,
    is_learning_analytics_rollout_enabled,
)
from src.modules.participant_analytics.compute_correctness import compute_response_correctness


def _response_correctness_value(correctness: str) -> str:
    return "WRONG" if correctness == "INCORRECT" else correctness


def summarize_eligible_element_responses(element: dict[str, Any]) -> list[dict[str, Any]]:
    element_data = element["elementData"]
    element_type = element_data["type"]
    if element_type == "FREE_TEXT":
        return []
    options = element_data.get("options")
    by_participant: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for detail in element["detailResponses"]:
        participation = detail["participation"]
        if not is_activity_eligible_for_learning_analytics(
            is_course_enabled=True,
            participation_status=participation["learningAnalyticsStatus"],
            acknowledged_disclosure_version=participation["learningAnalyticsDisclosureVersion"],
            included_from=participation["learningAnalyticsIncludedFrom"],
            activity_at=detail["createdAt"],
        ):
            continue
        correctness = compute_response_correctness(element_type, options, detail["response"])
        if correctness is None:
            continue
        by_participant[detail["participantId"]].append({**detail, "correctness": correctness})

    summaries = []
    for participant_id, details in by_participant.items():
        details.sort(key=lambda detail: detail["createdAt"])
        correctness = [detail["correctness"] for detail in details]
        summaries.append(
            {
                "id": details[0]["id"],
                "participantId": participant_id,
                "elementInstanceId": element["id"],
                "trialsCount": len(details),
                "totalScore": sum(detail["score"] for detail in details),
                "averageTimeSpent": sum(detail["timeSpent"] for detail in details) / len(details),
                "correctCount": correctness.count("CORRECT"),
                "partialCorrectCount": correctness.count("PARTIAL"),
                "wrongCount": correctness.count("INCORRECT"),
                "firstResponseCorrectness": _response_correctness_value(correctness[0]),
                "lastResponseCorrectness": _response_correctness_value(correctness[-1]),
            }
        )
    return summaries


def get_eligible_course_activities(
    session: Session,
    course_id: str,
    *,
    activity_statuses: list[str] | None = None,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]], list[dict[str, Any]]]:
    if not is_learning_analytics_rollout_enabled():
        return None, [], []

    course = session.execute(
        select(Course).where(
            Course.id == course_id,
            Course.isLearningAnalyticsEnabled.is_(True),
        )
    ).scalar_one_or_none()
    if course is None:
        return None, [], []

    def _activity_statement(model):
        statement = (
            select(model)
            .where(model.courseId == course_id)
            .options(selectinload(model.stacks).selectinload(ElementStack.elements))
        )
        if activity_statuses:
            statement = statement.where(model.status.in_(activity_statuses))
        return statement

    practice_quizzes = session.execute(_activity_statement(PracticeQuiz)).scalars().all()
    micro_learnings = session.execute(_activity_statement(MicroLearning)).scalars().all()

    detail_rows = session.execute(
        select(QuestionResponseDetail, Participation)
        .join(Participation, Participation.id == QuestionResponseDetail.participationId)
        .where(
            Participation.courseId == course_id,
            *current_participation_predicates(),
            QuestionResponseDetail.createdAt >= Participation.learningAnalyticsIncludedFrom,
            or_(
                QuestionResponseDetail.practiceQuiz.has(PracticeQuiz.courseId == course_id),
                QuestionResponseDetail.microLearning.has(MicroLearning.courseId == course_id),
            ),
        )
    ).all()
    details_by_element: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for detail, participation in detail_rows:
        detail_dict = row_to_dict(detail)
        detail_dict["participation"] = {
            "learningAnalyticsStatus": participation.learningAnalyticsStatus,
            "learningAnalyticsDisclosureVersion": participation.learningAnalyticsDisclosureVersion,
            "learningAnalyticsIncludedFrom": participation.learningAnalyticsIncludedFrom,
        }
        details_by_element[detail.elementInstanceId].append(detail_dict)

    def _activity_to_dict(activity) -> dict[str, Any]:
        activity_dict = row_to_dict(activity)
        activity_dict["stacks"] = []
        activity_dict["responses"] = []
        for stack in activity.stacks:
            stack_dict = row_to_dict(stack)
            stack_dict["elements"] = []
            for element in stack.elements:
                element_type = (element.elementData or {}).get("type")
                if element_type == "FREE_TEXT":
                    continue
                element_dict = row_to_dict(element)
                element_dict["detailResponses"] = details_by_element.get(element.id, [])
                element_dict["responses"] = summarize_eligible_element_responses(element_dict)
                activity_dict["responses"].extend(element_dict["responses"])
                stack_dict["elements"].append(element_dict)
            activity_dict["stacks"].append(stack_dict)
        return activity_dict

    eligible_participants = session.execute(
        select(Participation.participantId).where(
            Participation.courseId == course_id,
            *current_participation_predicates(),
        )
    ).scalars()
    course_dict = row_to_dict(course)
    course_dict["participations"] = [{"participantId": participant_id} for participant_id in eligible_participants]
    practice_quiz_dicts = [_activity_to_dict(activity) for activity in practice_quizzes]
    micro_learning_dicts = [_activity_to_dict(activity) for activity in micro_learnings]
    course_dict["practiceQuizzes"] = practice_quiz_dicts
    course_dict["microLearnings"] = micro_learning_dicts
    return course_dict, practice_quiz_dicts, micro_learning_dicts
