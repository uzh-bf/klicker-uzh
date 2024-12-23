import pandas as pd


def aggregate_analytics(df_details, df_course_responses=None):
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
    correctCount = (
        df_analytics_corr_temp["CORRECT"]
        if "CORRECT" in df_analytics_corr_temp.columns
        else 0
    )
    partialCount = (
        df_analytics_corr_temp["PARTIAL"]
        if "PARTIAL" in df_analytics_corr_temp.columns
        else 0
    )
    incorrectCount = (
        df_analytics_corr_temp["INCORRECT"]
        if "INCORRECT" in df_analytics_corr_temp.columns
        else 0
    )

    df_analytics_corr_temp["sum"] = correctCount + partialCount + incorrectCount
    df_analytics_corr_temp["meanCorrect"] = (
        df_analytics_corr_temp["CORRECT"] / df_analytics_corr_temp["sum"]
        if "CORRECT" in df_analytics_corr_temp.columns
        else 0
    )
    df_analytics_corr_temp["meanPartial"] = (
        df_analytics_corr_temp["PARTIAL"] / df_analytics_corr_temp["sum"]
        if "PARTIAL" in df_analytics_corr_temp.columns
        else 0
    )
    df_analytics_corr_temp["meanIncorrect"] = (
        df_analytics_corr_temp["INCORRECT"] / df_analytics_corr_temp["sum"]
        if "INCORRECT" in df_analytics_corr_temp.columns
        else 0
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

    df_course_analytics = None
    if df_course_responses is not None:
        # Count entries where firstResponseCorrectness is 'CORRECT', 'WRONG' and lastResponseCorrectness is 'CORRECT', 'WRONG' into separate columns - grouped by participantId and courseId
        df_course_analytics = (
            df_course_responses.groupby(["participantId", "courseId"])
            .agg(
                {
                    "firstResponseCorrectness": [
                        ("correct", lambda x: (x == "CORRECT").sum()),
                        ("wrong", lambda x: (x == "WRONG").sum()),
                    ],
                    "lastResponseCorrectness": [
                        ("correct", lambda x: (x == "CORRECT").sum()),
                        ("wrong", lambda x: (x == "WRONG").sum()),
                    ],
                }
            )
            .reset_index()
        )
        df_course_analytics.columns = df_course_analytics.columns.map(
            "_".join
        ).str.strip("_")
        df_course_analytics = df_course_analytics.rename(
            columns={
                "firstResponseCorrectness_correct": "firstCorrectCount",
                "firstResponseCorrectness_wrong": "firstWrongCount",
                "lastResponseCorrectness_correct": "lastCorrectCount",
                "lastResponseCorrectness_wrong": "lastWrongCount",
            }
        )

    # Combine the analytics counts and correctness dataframes based on the unique participantId and courseId combinations
    if df_course_analytics is None:
        df_analytics = pd.merge(
            df_analytics_counts,
            df_analytics_correctness,
            on=["participantId", "courseId"],
        )
    else:
        df_analytics = pd.merge(
            df_analytics_counts,
            pd.merge(
                df_analytics_correctness,
                df_course_analytics,
                on=["participantId", "courseId"],
            ),
            on=["participantId", "courseId"],
        )

    return df_analytics
