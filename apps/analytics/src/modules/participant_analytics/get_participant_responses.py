import pandas as pd
from datetime import date


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
        detail["course_start_date"] = date(9999, 12, 31)
        detail["course_end_date"] = date(9999, 12, 31)

    return detail


def get_participant_responses(db, start_date, end_date, verbose=False):
    participant_response_details = db.participant.find_many(
        include={
            "detailQuestionResponses": {
                "where": {"createdAt": {"gte": start_date, "lte": end_date}},
                "include": {
                    "practiceQuiz": {"include": {"course": True}},
                    "microLearning": {"include": {"course": True}},
                },
            },
        }
    )

    if verbose:
        # Print the first 5 question response details
        print(
            "Found {} participants for the timespan from {} to {}".format(
                len(participant_response_details), start_date, end_date
            )
        )
        print(participant_response_details[0])

    # Convert the question response details to a pandas dataframe
    df_details = convert_to_df(participant_response_details)

    # Filter out the question response details that are not within the course dates and do not consider them for the analysis
    if verbose:
        print(
            "Number of question response details before course date filtering:",
            len(df_details),
        )

    df_details = df_details.apply(set_course_dates, axis=1)

    return df_details
