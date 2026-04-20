import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import ElementInstance


def map_element_instance_options(instance: ElementInstance) -> dict:
    return {
        "elementInstanceId": instance.id,
        "type": instance.elementData.get("type") if instance.elementData else None,
        "options": (instance.elementData or {}).get("options"),
    }


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
                else "PARTIAL"
                if hamming_distance == 1
                else "INCORRECT"
            )

    elif element_instance["type"] == "NUMERICAL":
        response_value = float(response["value"])

        if "solutionRanges" in options:
            within_range = list(
                map(
                    lambda range: (
                        float(range["min"]) <= response_value <= float(range["max"])
                    ),
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
                    lambda solution: (
                        float(solution) - 1e-10
                        <= response_value
                        <= float(solution) + 1e-10
                    ),
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
    element_instances = (
        session.execute(
            select(ElementInstance).where(ElementInstance.id.in_(element_instance_ids))
        )
        .scalars()
        .all()
    )

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
