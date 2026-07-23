from .load_participant_analytics import load_participant_analytics
from .aggregate_participant_analytics import aggregate_participant_analytics
from .save_aggregated_analytics import save_aggregated_analytics


def compute_aggregated_analytics(db, start_date, end_date, timestamp, analytics_type="DAILY", verbose=False):
    # load all participant analytics for the given timestamp and analytics time range
    df_participant_analytics = load_participant_analytics(db, timestamp, analytics_type, verbose)

    # aggregate all participant analytics values by course
    df_aggregated_analytics = aggregate_participant_analytics(df_participant_analytics, verbose)

    if df_aggregated_analytics is not None and verbose:
        print("Aggregated analytics for time range:" + start_date + " to " + end_date)
        print(df_aggregated_analytics.head())
    elif df_aggregated_analytics is None:
        print("No aggregated analytics to compute for time range:" + start_date + " to " + end_date)

    # store the computed aggregated analytics in the database
    if df_aggregated_analytics is not None:
        save_aggregated_analytics(db, df_aggregated_analytics, timestamp, analytics_type)
