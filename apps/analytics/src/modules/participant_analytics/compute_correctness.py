from math import isfinite

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import ElementInstance

_EPSILON = 2.220446049250313e-16


def _finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(float(value))


def map_element_instance_options(instance: ElementInstance) -> dict:
    return {
        "elementInstanceId": instance.id,
        "type": instance.elementData.get("type") if instance.elementData else None,
        "options": (instance.elementData or {}).get("options"),
    }


def _selection_correctness(response, options):
    if not isinstance(options, dict):
        return None

    if not options.get("hasSampleSolution", False):
        return "CORRECT"

    if not isinstance(response, dict):
        return None

    selected = response.get("selection")
    if not selected:
        return None

    number_of_inputs = options.get("numberOfInputs")
    correct_answers = options.get("answerCollectionSolutionIds")
    if not number_of_inputs or not correct_answers:
        return None

    deduped = list(dict.fromkeys(selected))
    valid_responses = [answer_id for answer_id in deduped if answer_id in correct_answers]
    correctness = len(valid_responses) / number_of_inputs

    if correctness == 1:
        return "CORRECT"
    if correctness == 0:
        return "INCORRECT"
    return "PARTIAL"


def _case_study_response_map(assessment):
    if isinstance(assessment, dict):
        return {
            str(case_id): {
                str(item_id): {
                    str(criterion_id): response_value for criterion_id, response_value in (criterion_map or {}).items()
                }
                for item_id, criterion_map in (case_map or {}).items()
            }
            for case_id, case_map in assessment.items()
        }

    if not isinstance(assessment, list):
        return {}

    response_map = {}
    for case_response in assessment:
        if not isinstance(case_response, dict):
            continue
        case_id = case_response.get("caseId")
        if case_id is None:
            continue
        case_bucket = response_map.setdefault(str(case_id), {})
        for item_response in case_response.get("itemResponses") or []:
            if not isinstance(item_response, dict):
                continue
            item_id = item_response.get("itemId")
            if item_id is None:
                continue
            item_bucket = case_bucket.setdefault(str(item_id), {})
            for criterion_response in item_response.get("criterionResponses") or []:
                if not isinstance(criterion_response, dict):
                    continue
                criterion_id = criterion_response.get("criterionId")
                if criterion_id is None:
                    continue
                item_bucket[str(criterion_id)] = criterion_response.get("response")
    return response_map


def _case_study_correctness(response, options):
    if not isinstance(options, dict):
        return None

    if not options.get("hasSampleSolution", False):
        return "CORRECT"

    if not isinstance(response, dict):
        return None

    assessment = response.get("assessment")
    if not assessment:
        return None

    cases = options.get("cases")
    if not isinstance(cases, list) or not cases:
        return None

    if any(not case_item.get("solutions") for case_item in cases if isinstance(case_item, dict)):
        return None

    response_map = _case_study_response_map(assessment)
    total_assessment_cases = 0
    total_correct_cases = 0

    for case_item in cases:
        if not isinstance(case_item, dict):
            continue
        case_id = str(case_item.get("id"))
        for item_solution in case_item.get("solutions") or []:
            if not isinstance(item_solution, dict):
                continue
            item_id = str(item_solution.get("itemId"))
            for criterion_solution in item_solution.get("criteriaSolutions") or []:
                if not isinstance(criterion_solution, dict):
                    continue
                criterion_id = str(criterion_solution.get("criterionId"))
                response_value = response_map.get(case_id, {}).get(item_id, {}).get(criterion_id)
                total_assessment_cases += 1

                if response_value is None:
                    continue

                try:
                    submitted_value = float(response_value)
                    min_value = float(criterion_solution["min"])
                    max_value = float(criterion_solution["max"])
                except (KeyError, TypeError, ValueError):
                    continue

                if submitted_value >= min_value - _EPSILON and submitted_value <= max_value + _EPSILON:
                    total_correct_cases += 1

    correctness = 0 if total_assessment_cases == 0 else total_correct_cases / total_assessment_cases
    if correctness == 1:
        return "CORRECT"
    if correctness == 0:
        return "INCORRECT"
    return "PARTIAL"


def _numerical_correctness(response, options):
    if not isinstance(response, dict) or not isinstance(options, dict):
        return None

    try:
        response_value = float(response["value"])
    except (KeyError, TypeError, ValueError):
        return None
    if not isfinite(response_value):
        return None

    solution_ranges = options.get("solutionRanges") or []
    exact_solutions = options.get("exactSolutions") or []
    if not solution_ranges and not exact_solutions:
        return None

    if solution_ranges:
        defined_ranges = []
        for solution_range in solution_ranges:
            if not isinstance(solution_range, dict):
                continue

            min_value = solution_range.get("min")
            max_value = solution_range.get("max")
            defined_min = min_value if _finite_number(min_value) else None
            defined_max = max_value if _finite_number(max_value) else None
            if defined_min is not None or defined_max is not None:
                defined_ranges.append((defined_min, defined_max))

        if not defined_ranges:
            return None

        for min_value, max_value in defined_ranges:
            above_min = min_value is None or response_value >= min_value - _EPSILON
            below_max = max_value is None or response_value <= max_value + _EPSILON
            if above_min and below_max:
                return "CORRECT"
        return "INCORRECT"

    for solution in exact_solutions:
        try:
            numerical_solution = float(solution)
        except (TypeError, ValueError):
            continue
        if numerical_solution - _EPSILON <= response_value <= numerical_solution + _EPSILON:
            return "CORRECT"
    return "INCORRECT"


def compute_response_correctness(element_type, options, response):
    if element_type in {"FLASHCARD", "CONTENT"}:
        return None

    if element_type == "SC":
        if not isinstance(response, dict) or not isinstance(options, dict):
            return None
        selected_choices = response.get("choices")
        choices = options.get("choices")
        if not isinstance(selected_choices, list) or not selected_choices or not isinstance(choices, list):
            return None
        correct_choice = next(
            (choice.get("ix") for choice in choices if isinstance(choice, dict) and choice.get("correct")),
            None,
        )
        return "CORRECT" if selected_choices[0] == correct_choice else "INCORRECT"

    if element_type in {"MC", "KPRIM"}:
        if not isinstance(response, dict) or not isinstance(options, dict):
            return None
        selected_choices = response.get("choices")
        choices = options.get("choices")
        if not isinstance(selected_choices, list) or not isinstance(choices, list) or not choices:
            return None
        correct_choices = [choice.get("ix") for choice in choices if isinstance(choice, dict) and choice.get("correct")]
        available_choices = len(choices)
        selected_choices_array = [1 if ix in selected_choices else 0 for ix in range(available_choices)]
        correct_choices_array = [1 if ix in correct_choices else 0 for ix in range(available_choices)]
        hamming_distance = sum(
            1 for index in range(available_choices) if selected_choices_array[index] != correct_choices_array[index]
        )

        if element_type == "MC":
            correctness = max(-2 * hamming_distance / available_choices + 1, 0)
            if correctness == 1:
                return "CORRECT"
            if correctness == 0:
                return "INCORRECT"
            return "PARTIAL"
        return "CORRECT" if hamming_distance == 0 else "PARTIAL" if hamming_distance == 1 else "INCORRECT"

    if element_type == "NUMERICAL":
        return _numerical_correctness(response, options)

    if element_type == "FREE_TEXT":
        if not isinstance(response, dict) or not isinstance(options, dict):
            return None
        if "solutions" not in options:
            return "CORRECT"
        response_value = response.get("value")
        if not isinstance(response_value, str):
            return None
        solutions = [str(solution).strip().lower() for solution in options["solutions"]]
        return "CORRECT" if response_value.strip().lower() in solutions else "INCORRECT"

    if element_type == "SELECTION":
        return _selection_correctness(response, options)

    if element_type == "CASE_STUDY":
        return _case_study_correctness(response, options)

    raise ValueError(f"Unknown element type: {element_type}")


def compute_correctness_columns(df_element_instances, row):
    element_instance = df_element_instances[df_element_instances["elementInstanceId"] == row["elementInstanceId"]].iloc[
        0
    ]
    response = row["response"]
    options = element_instance["options"]

    return compute_response_correctness(element_instance["type"], options, response)


def compute_correctness(session: Session, df_details, verbose: bool = False):
    if len(df_details) == 0:
        print("No question response details found for the given date.")
        return None, None

    df_details["course_start_date"] = pd.to_datetime(df_details["course_start_date"])
    df_details["course_end_date"] = pd.to_datetime(df_details["course_end_date"])
    df_details = df_details[
        (df_details["course_start_date"] <= df_details["createdAt"])
        & (df_details["course_end_date"] >= df_details["createdAt"])
    ]

    if verbose:
        print(
            "Number of question response details after course date filtering:",
            len(df_details),
        )

    df_details = df_details[
        [
            "score",
            "pointsAwarded",
            "xpAwarded",
            "timeSpent",
            "response",
            "createdAt",
            "elementInstanceId",
            "participantId",
            "courseId",
        ]
    ]

    if verbose:
        print("Question detail responses:", len(df_details))
        print("Columns:", df_details.columns)

    element_instance_ids = df_details["elementInstanceId"].unique().tolist()
    element_instances = (
        session.execute(select(ElementInstance).where(ElementInstance.id.in_(element_instance_ids))).scalars().all()
    )

    df_element_instances = pd.DataFrame(list(map(map_element_instance_options, element_instances)))

    if len(df_element_instances) == 0:
        print("No element instances found for the given element instance ids.")
        return None, None

    df_details["correctness"] = df_details.apply(lambda x: compute_correctness_columns(df_element_instances, x), axis=1)
    df_details = df_details.dropna(subset=["correctness"])

    if verbose:
        print(
            "Number of question response details with correctness computed (no flashcards / content elements):",
            len(df_details),
        )

    return df_details, df_element_instances
