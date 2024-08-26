import pandas as pd


def aggregate_analytics(df_details, verbose=False):
    # Aggregate the question response details for the participant and course level
    df_analytics_counts = (
        df_details.groupby(["participantId", "courseId"])
        .agg(
            {
                "score": "sum",
                "pointsAwarded": "sum",
                "xpAwarded": "sum",
                "timeSpent": "sum",
                "elementInstanceId": [
                    "count",
                    "nunique",
                ],  # count = trialsCount, nunique = responseCount
            }
        )
        .reset_index()
    )

    # Count the 'CORRECT', 'PARTIAL', and 'INCORRECT' entries for each participantId and elementInstanceId combination
    df_analytics_corr_temp = (
        df_details.groupby(
            ["participantId", "elementInstanceId", "courseId", "correctness"]
        )
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )

    # Divide each of the correctness columns by the sum of all and rename them to meanCorrect, meanPartial, meanIncorrect
    df_analytics_corr_temp["sum"] = (
        df_analytics_corr_temp["CORRECT"]
        + df_analytics_corr_temp["PARTIAL"]
        + df_analytics_corr_temp["INCORRECT"]
    )
    df_analytics_corr_temp["meanCorrect"] = (
        df_analytics_corr_temp["CORRECT"] / df_analytics_corr_temp["sum"]
    )
    df_analytics_corr_temp["meanPartial"] = (
        df_analytics_corr_temp["PARTIAL"] / df_analytics_corr_temp["sum"]
    )
    df_analytics_corr_temp["meanIncorrect"] = (
        df_analytics_corr_temp["INCORRECT"] / df_analytics_corr_temp["sum"]
    )

    # Aggregate the correctness columns for each participantId and courseId
    df_analytics_correctness = (
        df_analytics_corr_temp.groupby(["participantId", "courseId"])
        .agg({"meanCorrect": "sum", "meanPartial": "sum", "meanIncorrect": "sum"})
        .reset_index()
        .rename(
            columns={
                "meanCorrect": "meanCorrectCount",
                "meanPartial": "meanPartialCount",
                "meanIncorrect": "meanWrongCount",
            }
        )
    )

    # Map the counts in the corresponding analytics dataframe to a single level
    df_analytics_counts.columns = df_analytics_counts.columns.map("_".join).str.strip(
        "_"
    )
    df_analytics_counts = df_analytics_counts.rename(
        columns={
            "score_sum": "totalScore",
            "pointsAwarded_sum": "totalPoints",
            "xpAwarded_sum": "totalXp",
            "timeSpent_sum": "totalTimeSpent",
            "elementInstanceId_count": "trialsCount",
            "elementInstanceId_nunique": "responseCount",
        }
    )

    # Combine the analytics counts and correctness dataframes based on the unique participantId and courseId combinations
    df_analytics = pd.merge(
        df_analytics_counts, df_analytics_correctness, on=["participantId", "courseId"]
    )

    return df_analytics
