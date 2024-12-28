import pandas as pd


def convert_to_df(analytics):
    # convert the database query result into a pandas dataframe
    rows = []
    for item in analytics:
        rows.append(dict(item))

    return pd.DataFrame(rows)


def load_participant_analytics(db, timestamp, analytics_type, verbose=False):
    participant_analytics = db.participantanalytics.find_many(
        where={"timestamp": timestamp, "type": analytics_type},
    )

    if verbose:
        # Print the first participant analytics
        print(
            "Found {} analytics for the timespan from {} to {}".format(
                len(participant_analytics), start_date, end_date
            )
        )
        print(participant_analytics[0])

    # convert the analytics to a dataframe
    df_loaded_analytics = convert_to_df(participant_analytics)

    return df_loaded_analytics
