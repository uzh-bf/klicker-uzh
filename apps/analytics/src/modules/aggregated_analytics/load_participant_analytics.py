import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db_helpers import row_to_dict
from src.models import ParticipantAnalytics


def load_participant_analytics(
    session: Session, timestamp, analytics_type, verbose=False
):
    participant_analytics = (
        session.execute(
            select(ParticipantAnalytics).where(
                ParticipantAnalytics.timestamp == timestamp,
                ParticipantAnalytics.type == analytics_type,
            )
        )
        .scalars()
        .all()
    )

    if verbose:
        print(
            "Found {} analytics for timestamp={} type={}".format(
                len(participant_analytics), timestamp, analytics_type
            )
        )
        if participant_analytics:
            print(row_to_dict(participant_analytics[0]))

    return pd.DataFrame([row_to_dict(item) for item in participant_analytics])
