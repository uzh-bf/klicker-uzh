import pandas as pd


def compute_instance_performance(db, activity, total_only=False):
    # initialize dataframes for performance tracking
    df_instance_performance = pd.DataFrame(
        columns=[
            "instanceId",
            "responseCount",
            "firstErrorRate",
            "firstPartialRate",
            "firstCorrectRate",
            "lastErrorRate",
            "lastPartialRate",
            "lastCorrectRate",
            "totalErrorRate",
            "totalPartialRate",
            "totalCorrectRate",
        ]
    )

    for stack in activity["stacks"]:
        for instance in stack["elements"]:
            df_responses = pd.DataFrame(instance["responses"])

            if df_responses.empty:
                continue

            # count number of responses
            num_responses = len(df_responses)

            if not total_only:
                # compute correctness rates for first and last response
                first_error_rate = (
                    df_responses["firstResponseCorrectness"]
                    .value_counts()
                    .get("WRONG", 0)
                    / num_responses
                )
                first_partial_rate = (
                    df_responses["firstResponseCorrectness"]
                    .value_counts()
                    .get("PARTIAL", 0)
                    / num_responses
                )
                first_correct_rate = (
                    df_responses["firstResponseCorrectness"]
                    .value_counts()
                    .get("CORRECT", 0)
                    / num_responses
                )
                last_error_rate = (
                    df_responses["lastResponseCorrectness"]
                    .value_counts()
                    .get("WRONG", 0)
                    / num_responses
                )
                last_partial_rate = (
                    df_responses["lastResponseCorrectness"]
                    .value_counts()
                    .get("PARTIAL", 0)
                    / num_responses
                )
                last_correct_rate = (
                    df_responses["lastResponseCorrectness"]
                    .value_counts()
                    .get("CORRECT", 0)
                    / num_responses
                )

            # compute total correctness rates
            df_responses["responseErrorRate"] = (
                df_responses["wrongCount"] / df_responses["trialsCount"]
            )
            df_responses["responsePartialRate"] = (
                df_responses["partialCorrectCount"] / df_responses["trialsCount"]
            )
            df_responses["responseCorrectRate"] = (
                df_responses["correctCount"] / df_responses["trialsCount"]
            )
            total_error_rate = df_responses["responseErrorRate"].mean()
            total_partial_rate = df_responses["responsePartialRate"].mean()
            total_correct_rate = df_responses["responseCorrectRate"].mean()

            # append instance values to dataframe
            df_instance_performance.loc[len(df_instance_performance)] = {
                "instanceId": instance["id"],
                "responseCount": num_responses,
                "firstErrorRate": first_error_rate,
                "firstPartialRate": first_partial_rate,
                "firstCorrectRate": first_correct_rate,
                "lastErrorRate": last_error_rate,
                "lastPartialRate": last_partial_rate,
                "lastCorrectRate": last_correct_rate,
                "totalErrorRate": total_error_rate,
                "totalPartialRate": total_partial_rate,
                "totalCorrectRate": total_correct_rate,
            }

    return df_instance_performance
