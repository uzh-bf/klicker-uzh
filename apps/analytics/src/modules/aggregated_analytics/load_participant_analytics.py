import pandas as pd

from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    ensure_analytics_eligibility,
    filter_dataframe_by_participants,
    filter_dataframe_by_enabled_courses,
)


def convert_to_df(analytics):
    # convert the database query result into a pandas dataframe
    rows = []
    for item in analytics:
        rows.append(dict(item))

    return pd.DataFrame(rows)


def load_participant_analytics(
    db,
    timestamp,
    analytics_type,
    verbose=False,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    eligibility = ensure_analytics_eligibility(db, eligibility)
    if not eligibility.participant_ids:
        return pd.DataFrame()

    participant_analytics = db.participantanalytics.find_many(
        where={
            "timestamp": timestamp,
            "type": analytics_type,
            "participantId": {"in": list(eligibility.participant_ids)},
        },
    )

    if verbose:
        # Print the first participant analytics
        print("Found {} analytics for timestamp {}".format(len(participant_analytics), timestamp))
        if len(participant_analytics) > 0:
            print(participant_analytics[0])

    # convert the analytics to a dataframe
    df_loaded_analytics = convert_to_df(participant_analytics)

    # ParticipantAnalytics is a derived input. Its computedAt date is not the
    # raw response creation time, so applying the prospective response rule to
    # it would discard valid same-day re-enabled responses. Pending cleanup and
    # the publication fence prevent stale derivatives from being reused.
    df_loaded_analytics = filter_dataframe_by_participants(
        df_loaded_analytics,
        eligibility,
    )
    return filter_dataframe_by_enabled_courses(db, df_loaded_analytics)
