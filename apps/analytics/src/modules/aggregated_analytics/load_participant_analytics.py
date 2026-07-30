import pandas as pd
from src.modules.learning_analytics_eligibility import (
    LEARNING_ANALYTICS_DISCLOSURE_VERSION,
    is_learning_analytics_rollout_enabled,
)


def convert_to_df(analytics):
    # convert the database query result into a pandas dataframe
    rows = []
    for item in analytics:
        rows.append(dict(item))

    return pd.DataFrame(rows)


def load_participant_analytics(db, timestamp, analytics_type, verbose=False):
    if not is_learning_analytics_rollout_enabled():
        return pd.DataFrame()

    participant_analytics = db.participantanalytics.find_many(
        where={"timestamp": timestamp, "type": analytics_type},
    )
    eligible_participations = db.participation.find_many(
        where={
            "learningAnalyticsStatus": "INCLUDED",
            "learningAnalyticsDisclosureVersion": LEARNING_ANALYTICS_DISCLOSURE_VERSION,
            "learningAnalyticsIncludedFrom": {"not": None},
            "course": {"isLearningAnalyticsEnabled": True},
        }
    )
    eligible_keys = {(participation.courseId, participation.participantId) for participation in eligible_participations}
    participant_analytics = [
        analytics
        for analytics in participant_analytics
        if (analytics.courseId, analytics.participantId) in eligible_keys
    ]

    if verbose:
        # Print the first participant analytics
        print("Found {} analytics for timestamp {}".format(len(participant_analytics), timestamp))
        if len(participant_analytics) > 0:
            print(participant_analytics[0])

    # convert the analytics to a dataframe
    df_loaded_analytics = convert_to_df(participant_analytics)

    return df_loaded_analytics
