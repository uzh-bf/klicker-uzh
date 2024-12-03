import pandas as pd


def aggregate_daily_analytics(
    db, start_date, end_date, timestamp, aggregation_level="WEEKLY", verbose=False
):
    # fetch all daily analytics for the given date range
    df_daily_analytics = get_daily_participant_analytics(
        db, start_date, end_date, verbose
    )

    # aggregate the daily analytics based on weekly or monthly aggregation levels
    if aggregation_level == "WEEKLY":
        # aggregate the daily analytics over the queried timespan
        df_analytics = combine_daily_analytics(df_daily_analytics)

        # store the aggregated analytics
        save_participant_analytics(db, df_analytics, timestamp, analytics_type)

    elif aggregation_level == "MONTHLY":
        # aggregate the daily analytics over the queried timespan
        df_analytics = combine_daily_analytics(df_daily_analytics)

        # store the aggregated analytics
        save_participant_analytics(db, df_analytics, timestamp, analytics_type)

    else:
        raise ValueError(f"Invalid aggregation level: {aggregation_level}")


def convert_to_df(analytics):
    # convert the database query result into a pandas dataframe
    rows = []
    for item in analytics:
        rows.append(dict(item))

    return pd.DataFrame(rows)


def get_daily_participant_analytics(db, start_date, end_date, verbose=False):
    daily_analytics = db.participantanalytics.find_many(
        where={"timestamp": {"gte": start_date, "lte": end_date}},
        # include={"participant": True, "course": True},
    )

    if verbose:
        # Print the first daily participant analytics
        print(
            "Found {} analytics for the timespan from {} to {}".format(
                len(daily_analytics), start_date, end_date
            )
        )
        print(daily_analytics[0])

    # convert the analytics to a dataframe
    df_analytics = convert_to_df(daily_analytics)

    return df_analytics


def combine_daily_analytics(df_daily_analytics):
    # ! The aggregation of daily analytics does probably not work, since the responseCount and
    # ! the mean counts over longer time horizons cannot be computed from their daily values

    # TODO: if the valuer were to be computed based on their daily values, the following columns need to be filled in a df_analytics dataframe
    # trialsCount, responseCount, totalScore, totalPoints, totalXp, meanCorrectCount, meanPartialCount, meanWrongCount, participantId, courseId

    return pd.DataFrame()
