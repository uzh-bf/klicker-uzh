def aggregate_participant_analytics(df_participant_analytics, verbose=False):
    # if the dataframe is empty, return None
    if df_participant_analytics.empty:
        if verbose:
            print("No participant analytics to aggregate")

        return None

    # aggreagte all participant analytics for the specified time range and separate courses
    df_aggregated_analytics = (
        df_participant_analytics.groupby("courseId")
        .agg(
            {
                "id": "count",
                "responseCount": "sum",
                "totalScore": "sum",
                "totalPoints": "sum",
                "totalXp": "sum",
            }
        )
        .reset_index()
        .rename(
            columns={
                "id": "participantCount",
            }
        )
    )

    return df_aggregated_analytics
