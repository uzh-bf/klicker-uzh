from datetime import date
import pandas as pd


def map_details(detail, participantId):
    courseId = (
        detail["practiceQuiz"]["courseId"]
        if detail["practiceQuiz"]
        else detail["microLearning"]["courseId"]
    )
    return {**detail, "participantId": participantId, "courseId": courseId}


def map_participants(participant):
    participant_dict = participant.dict()
    return list(
        map(
            lambda detail: map_details(detail, participant_dict["id"]),
            participant_dict["detailQuestionResponses"],
        )
    )


def convert_to_df(participants):
    return pd.DataFrame(
        [
            item
            for sublist in list(map(map_participants, participants))
            for item in sublist
        ]
    )


# Add the course start and end date to the dataframe for filtering of question response details later on
def set_course_dates(detail):
    if detail["practiceQuiz"] is not None:
        course = detail["practiceQuiz"]["course"]
        detail["course_start_date"] = course["startDate"]
        detail["course_end_date"] = course["endDate"]
    elif detail["microLearning"] is not None:
        course = detail["microLearning"]["course"]
        detail["course_start_date"] = course["startDate"]
        detail["course_end_date"] = course["endDate"]
    else:
        # If the instance is not part of a practice quiz or microlearning, set the start date far into the future -> no analytics should be computed
        print("ELSE CASE")
        detail["course_start_date"] = date(9999, 12, 31)
        detail["course_end_date"] = date(9999, 12, 31)

    return detail


def map_element_instance_options(instance):
    instance_dict = instance.dict()
    return {
        "elementInstanceId": instance_dict["id"],
        "type": instance_dict["elementData"]["type"],
        "options": (
            instance_dict["elementData"]["options"]
            if "options" in instance_dict["elementData"]
            else None
        ),
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
                else "PARTIAL" if hamming_distance == 1 else "INCORRECT"
            )

    elif element_instance["type"] == "NUMERICAL":
        response_value = float(response["value"])
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

        return "INCORRECT"

    elif element_instance["type"] == "FREE_TEXT":
        raise NotImplementedError(
            "Free text correctness computation not implemented yet"
        )

    else:
        raise ValueError("Unknown element type: {}".format(element_instance["type"]))


def compute_correctness(db, participant_response_details, verbose=False):
    # Convert the question response details to a pandas dataframe
    df_details = convert_to_df(participant_response_details)

    # Filter out the question response details that are not within the course dates and do not consider them for the analysis
    if verbose:
        print(
            "Number of question response details before course date filtering:",
            len(df_details),
        )

    df_details = df_details.apply(set_course_dates, axis=1)

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

    # Filter out the columns that are not needed
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

    # Compute correctness of the responses and add them as a separate column
    # Get related element instances
    element_instance_ids = df_details["elementInstanceId"].unique()
    element_instances = db.elementinstance.find_many(
        where={"id": {"in": element_instance_ids.tolist()}}
    )

    # Map the element instances to the corresponding elementData.options entries and convert it to a dataframe
    df_element_instances = pd.DataFrame(
        list(map(map_element_instance_options, element_instances))
    )

    # If no element instances were found for the given element instance ids, return None
    if len(df_element_instances) == 0:
        print("No element instances found for the given element instance ids.")
        return None, None

    # Compute the correctness for every response entry based on the element instance options (depending on the type of the element)
    df_details["correctness"] = df_details.apply(
        lambda x: compute_correctness_columns(df_element_instances, x), axis=1
    )
    df_details = df_details.dropna(subset=["correctness"])

    if verbose:
        print(
            "Number of question response details with correctness computed (no flashcards / content elements):",
            len(df_details),
        )

    return df_details, df_element_instances
