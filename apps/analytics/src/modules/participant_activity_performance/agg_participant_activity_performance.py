import pandas as pd
from .save_participant_activity_performance import save_participant_activity_performance


def agg_participant_activity_performance(db, df_responses, df_activities, participant_ids, course_id):
    # group the responses by participantId and activityId, sum up the totalScore and add a count for the number of responses
    df_responses_grouped = (
        df_responses.groupby(["participantId", "activityId"])
        .agg(
            totalScore=("totalScore", "sum"),
            trialsCount=("trialsCount", "sum"),
            responseCount=("totalScore", "count"),
        )
        .reset_index()
    )

    # iterate over all activities and participants in the course to create the corresponding entries
    for idx, activity in df_activities.iterrows():
        # setup dataframe to track participant activity performance
        df_activity_performance = pd.DataFrame(
            columns=[
                "participantId",
                "activityId",
                "activityType",
                "totalScore",
                "completion",
            ]
        )

        for participant_id in participant_ids:
            # get the responses for the current participant and activity
            response = df_responses_grouped[
                (df_responses_grouped["participantId"] == participant_id)
                & (df_responses_grouped["activityId"] == activity["id"])
            ]

            # if no entry exists in the grouped responses table, create a new entry with zero values
            if response.empty:
                df_activity_performance = pd.concat(
                    [
                        df_activity_performance,
                        pd.DataFrame(
                            [
                                {
                                    "participantId": participant_id,
                                    "activityId": activity["id"],
                                    "activityType": activity["type"],
                                    "totalScore": 0,
                                    "completion": 0,
                                }
                            ]
                        ),
                    ],
                    ignore_index=True,
                )

            else:
                # calculate the completion rate
                completion = response["responseCount"].iloc[0] / activity["instanceCount"]

                # add a new row to the results dataframe
                df_activity_performance = pd.concat(
                    [
                        df_activity_performance,
                        pd.DataFrame(
                            [
                                {
                                    "participantId": participant_id,
                                    "activityId": activity["id"],
                                    "activityType": activity["type"],
                                    "totalScore": response["totalScore"].iloc[0],
                                    "completion": completion,
                                }
                            ]
                        ),
                    ],
                    ignore_index=True,
                )

        # store the results in the database
        save_participant_activity_performance(db, df_activity_performance, activity["type"], course_id)
