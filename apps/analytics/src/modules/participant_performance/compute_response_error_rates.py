def compute_response_error_rates(df_responses):
    # compute the error rate for each response itself
    df_responses["responseErrorRate"] = df_responses["wrongCount"] / df_responses["trialsCount"]

    # compute the total number of responses, number of wrong first and last responses,
    # total number of wrong responses, and the average total error rate
    df_response_count = df_responses.groupby("participantId").size().reset_index(name="responseCount")
    df_first_response_wrong_count = (
        df_responses[df_responses["firstResponseCorrectness"] == "WRONG"]
        .groupby("participantId")
        .size()
        .reset_index(name="wrongFirstResponseCount")
    )
    df_last_response_wrong_count = (
        df_responses[df_responses["lastResponseCorrectness"] == "WRONG"]
        .groupby("participantId")
        .size()
        .reset_index(name="wrongLastResponseCount")
    )
    df_total_error_rate = (
        df_responses[["participantId", "responseErrorRate"]]
        .groupby("participantId")
        .agg("mean")
        .reset_index()
        .rename(
            columns={
                "responseErrorRate": "totalErrorRate",
            }
        )
    )

    # combine the dataframes into a single one
    df_performance = (
        df_response_count.merge(df_first_response_wrong_count, on="participantId", how="left")
        .merge(df_last_response_wrong_count, on="participantId", how="left")
        .merge(df_total_error_rate, on="participantId", how="left")
        .fillna(0)
    )

    # compute the first and last error rates
    df_performance["firstErrorRate"] = df_performance["wrongFirstResponseCount"] / df_performance["responseCount"]
    df_performance["lastErrorRate"] = df_performance["wrongLastResponseCount"] / df_performance["responseCount"]

    return df_performance
