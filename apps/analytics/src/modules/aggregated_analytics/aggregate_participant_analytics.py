def aggregate_participant_analytics(df_participant_analytics, verbose=False):
    # if the dataframe is empty, return None
    if df_participant_analytics.empty:
        if verbose:
            print("No participant analytics to aggregate")

        return None

    # ``participantId`` is present in both DB- and buffer-sourced rows; the
    # auto-generated ``id`` PK is missing on buffered rows because
    # ``save_participant_analytics`` never passes it to ``bulk_upsert``.
    df_aggregated_analytics = (
        df_participant_analytics.groupby("courseId")
        .agg(
            {
                "participantId": "count",
                "responseCount": "sum",
                "totalScore": "sum",
                "totalPoints": "sum",
                "totalXp": "sum",
            }
        )
        .reset_index()
        .rename(
            columns={
                "participantId": "participantCount",
            }
        )
    )

    return df_aggregated_analytics
