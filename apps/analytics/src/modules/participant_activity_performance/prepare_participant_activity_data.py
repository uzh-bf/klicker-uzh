import pandas as pd


def prepare_participant_activity_data(db, course_id: str):
    # fetch all asynchronous activities in the course alongside their question responses
    course = db.course.find_first(
        where={
            "id": course_id,
            "isDeleted": False,
        },
        include={
            "practiceQuizzes": {
                "where": {"status": {"in": ["PUBLISHED", "ENDED", "GRADED"]}},
                "include": {"stacks": {"include": {"elements": {"include": {"responses": True}}}}},
            },
            "microLearnings": {
                "where": {"status": {"in": ["PUBLISHED", "ENDED", "GRADED"]}},
                "include": {"stacks": {"include": {"elements": {"include": {"responses": True}}}}},
            },
            "participations": {"include": {"participant": True}},
        },
    )

    # convert prisma object to python dictionary
    course_dict = course.dict()

    # combine the activities into a single dataframe for easier processing
    df_activities = pd.concat(
        [
            pd.DataFrame(
                [
                    {
                        "id": activity["id"],
                        "type": activity_type,
                        "instanceCount": sum(len(stack["elements"]) for stack in activity["stacks"]),
                    }
                    for activity in course_dict[activity_type]
                ]
            )
            for activity_type in ["practiceQuizzes", "microLearnings"]
        ],
        ignore_index=True,
    )

    # get a list of all participant ids
    participant_ids = [p["participantId"] for p in course_dict["participations"]]

    # extract a list of all responses and add the activityId as a column, drop the stackId
    responses = []
    for activity in course_dict["practiceQuizzes"] + course_dict["microLearnings"]:
        for stack in activity["stacks"]:
            for element in stack["elements"]:
                for response in element["responses"]:
                    responses.append(
                        {
                            "activityId": activity["id"],
                            "participantId": response["participantId"],
                            "elementId": element["id"],
                            "totalScore": response["totalScore"],
                            "trialsCount": response["trialsCount"],
                        }
                    )
    df_responses = pd.DataFrame(responses)

    return df_activities, df_responses, participant_ids
