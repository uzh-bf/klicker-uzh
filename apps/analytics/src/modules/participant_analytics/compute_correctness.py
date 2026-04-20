import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import ElementInstance

_EPSILON = 2.220446049250313e-16


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
                    str(criterion_id): response_value
                    for criterion_id, response_value in (criterion_map or {}).items()
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

    correctness = (
        0
        if total_assessment_cases == 0
        else total_correct_cases / total_assessment_cases
    )
    if correctness == 1:
        return "CORRECT"
    if correctness == 0:
        return "INCORRECT"
    return "PARTIAL"


def compute_correctness_columns(df_element_instances, row):
    element_instance = df_element_instances[
        df_element_instances["elementInstanceId"] == row["elementInstanceId"]
    ].iloc[0]
    response = row["response"]
    options = element_instance["options"]

    if element_instance["type"] == "FLASHCARD" or element_instance["type"] == "CONTENT":
        return None

    elif element_instance["type"] == "SC":
        selected_choice = response["choices"][0]
        correct_choice = next(
            (choice["ix"] for choice in options["choices"] if choice["correct"]), None
        )
        return "CORRECT" if selected_choice == correct_choice else "INCORRECT"

    elif element_instance["type"] == "MC" or element_instance["type"] == "KPRIM":
        selected_choices = response["choices"]
        correct_choices = [
            choice["ix"] for choice in options["choices"] if choice["correct"]
        ]
        available_choices = len(options["choices"])

        selected_choices_array = [
            1 if ix in selected_choices else 0 for ix in range(available_choices)
        ]
        correct_choices_array = [
            1 if ix in correct_choices else 0 for ix in range(available_choices)
        ]
        hamming_distance = sum(
            [
                1
                for i in range(available_choices)
                if selected_choices_array[i] != correct_choices_array[i]
            ]
        )

        if element_instance["type"] == "MC":
            correctness = max(-2 * hamming_distance / available_choices + 1, 0)
            if correctness == 1:
                return "CORRECT"
            elif correctness == 0:
                return "INCORRECT"
            else:
                return "PARTIAL"
        elif element_instance["type"] == "KPRIM":
            return (
                "CORRECT"
                if hamming_distance == 0
                else "PARTIAL" if hamming_distance == 1 else "INCORRECT"
            )

    elif element_instance["type"] == "NUMERICAL":
        response_value = float(response["value"])

        if "solutionRanges" in options:
            within_range = list(
                map(
                    lambda range: float(range["min"])
                    <= response_value
                    <= float(range["max"]),
                    options["solutionRanges"],
                )
            )
            if any(within_range):
                return "CORRECT"
            else:
                return "INCORRECT"

        elif "exactSolutions" in options:
            response_correct = list(
                map(
                    lambda solution: float(solution) - 1e-10
                    <= response_value
                    <= float(solution) + 1e-10,
                    options["exactSolutions"],
                )
            )

            if any(response_correct):
                return "CORRECT"
            else:
                return "INCORRECT"

        return "INCORRECT"

    elif element_instance["type"] == "FREE_TEXT":
        # if no sample solution is specified, automatically grade as correct
        if "solutions" not in options:
            return "CORRECT"

        # otherwise, check if the response (ignoring capitalization) is included
        # in the list of solutions
        response_value = response["value"]
        solutions = list(
            map(lambda solution: solution.strip().lower(), options["solutions"])
        )
        if response_value.strip().lower() in solutions:
            return "CORRECT"

        return "INCORRECT"

    elif element_instance["type"] == "SELECTION":
        return _selection_correctness(response, options)

    elif element_instance["type"] == "CASE_STUDY":
        return _case_study_correctness(response, options)

    else:
        raise ValueError("Unknown element type: {}".format(element_instance["type"]))


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
            "elementInstanceId",
            "participantId",
            "courseId",
        ]
    ]

    if verbose:
        print("Question detail responses:", len(df_details))
        print("Columns:", df_details.columns)

    element_instance_ids = df_details["elementInstanceId"].unique().tolist()
    element_instances = session.execute(
        select(ElementInstance).where(ElementInstance.id.in_(element_instance_ids))
    ).scalars().all()

    df_element_instances = pd.DataFrame(
        list(map(map_element_instance_options, element_instances))
    )

    if len(df_element_instances) == 0:
        print("No element instances found for the given element instance ids.")
        return None, None

    df_details["correctness"] = df_details.apply(
        lambda x: compute_correctness_columns(df_element_instances, x), axis=1
    )
    df_details = df_details.dropna(subset=["correctness"])

    if verbose:
        print(
            "Number of question response details with correctness computed "
            "(no flashcards / content elements):",
            len(df_details),
        )

    return df_details, df_element_instances
