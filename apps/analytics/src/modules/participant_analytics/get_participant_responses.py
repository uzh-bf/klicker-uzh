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

    return participant_response_details
