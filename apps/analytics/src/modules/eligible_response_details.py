from collections import defaultdict
from typing import Any

from src.modules.learning_analytics_eligibility import (
    LEARNING_ANALYTICS_DISCLOSURE_VERSION,
    is_activity_eligible_for_learning_analytics,
    is_learning_analytics_rollout_enabled,
)
from src.modules.participant_analytics.compute_correctness import compute_response_correctness


def _response_correctness_value(correctness: str) -> str:
    return "WRONG" if correctness == "INCORRECT" else correctness


def summarize_eligible_element_responses(element: dict[str, Any]) -> list[dict[str, Any]]:
    element_data = element["elementData"]
    element_type = element_data["type"]
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
    db: Any,
    course_id: str,
    *,
    activity_statuses: list[str] | None = None,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]], list[dict[str, Any]]]:
    if not is_learning_analytics_rollout_enabled():
        return None, [], []

    activity_where = {"status": {"in": activity_statuses}} if activity_statuses else None
    activity_include = {
        "stacks": {
            "include": {
                "elements": {
                    "include": {
                        "detailResponses": {
                            "where": {
                                "elementInstance": {
                                    "elementType": {"not": "FREE_TEXT"},
                                }
                            },
                            "include": {
                                "participation": True,
                            },
                        }
                    }
                }
            }
        }
    }
    course = db.course.find_first(
        where={
            "id": course_id,
            "isLearningAnalyticsEnabled": True,
        },
        include={
            "practiceQuizzes": {
                **({"where": activity_where} if activity_where else {}),
                "include": activity_include,
            },
            "microLearnings": {
                **({"where": activity_where} if activity_where else {}),
                "include": activity_include,
            },
            "participations": {
                "where": {
                    "learningAnalyticsStatus": "INCLUDED",
                    "learningAnalyticsDisclosureVersion": LEARNING_ANALYTICS_DISCLOSURE_VERSION,
                    "learningAnalyticsIncludedFrom": {"not": None},
                }
            },
        },
    )
    if course is None:
        return None, [], []

    course_dict = course.dict()
    for activity in course_dict["practiceQuizzes"] + course_dict["microLearnings"]:
        activity["responses"] = []
        for stack in activity["stacks"]:
            stack["elements"] = [
                element for element in stack["elements"] if element["elementData"]["type"] != "FREE_TEXT"
            ]
            for element in stack["elements"]:
                element["responses"] = summarize_eligible_element_responses(element)
                activity["responses"].extend(element["responses"])

    return course_dict, course_dict["practiceQuizzes"], course_dict["microLearnings"]
