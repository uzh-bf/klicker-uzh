import pandas as pd


def compute_progress_counts(activity):
    started_count = 0
    completed_count = 0
    repeated_count = 0

    if len(activity["responses"]) != 0:
        # count number of elements in activity stacks
        num_elements = 0
        for stack in activity["stacks"]:
            num_elements += len(stack["elements"])

        # group the activity responses by participant and count them
        df_responses = pd.DataFrame(activity["responses"])
        df_statistics = (
            df_responses[["id", "trialsCount", "participantId"]]
            .groupby("participantId")
            .agg({"id": "count", "trialsCount": "min"})
            .rename(columns={"id": "count", "trialsCount": "min_trials"})
        )

        # compute number of participants that have started the activity
        started_count = len(df_statistics[df_statistics["count"] <= num_elements])

        # compute number of participants that have completed the activity
        completed_count = len(df_statistics[df_statistics["count"] == num_elements])

        # count the number of participants that have repeated the activity (completed and min_trials >= 2)
        repeated_count = len(
            df_statistics[
                (df_statistics["count"] == num_elements)
                & (df_statistics["min_trials"] >= 2)
            ]
        )

    else:
        print("No responses found for activity", activity["id"])

    return started_count, completed_count, repeated_count
