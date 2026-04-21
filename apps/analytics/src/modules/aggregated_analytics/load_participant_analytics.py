import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db_helpers import coerce_date, row_to_dict
from src.dryrun import buffer_registry
from src.models import ParticipantAnalytics


def load_participant_analytics(
    session: Session,
    timestamp,
    analytics_type,
    verbose=False,
    course_ids: list[str] | None = None,
):
    if course_ids == []:
        if verbose:
            print(
                "Found 0 analytics for timestamp={} type={} (empty course scope)".format(
                    coerce_date(timestamp), analytics_type
                )
            )
        return pd.DataFrame()

    timestamp_value = coerce_date(timestamp)

    buffered_rows = buffer_registry.filter_rows(
        "ParticipantAnalytics",
        course_ids=course_ids,
        type_value=analytics_type,
    )
    if buffered_rows is not None:
        df = _filter_buffered_rows_by_timestamp(buffered_rows, timestamp_value)
        if verbose:
            print(
                "Found {} analytics for timestamp={} type={} (buffer)".format(
                    len(df), timestamp_value, analytics_type
                )
            )
        return df

    stmt = select(ParticipantAnalytics).where(
        ParticipantAnalytics.timestamp == timestamp_value,
        ParticipantAnalytics.type == analytics_type,
    )
    if course_ids is not None:
        stmt = stmt.where(ParticipantAnalytics.courseId.in_(course_ids))

    participant_analytics = session.execute(stmt).scalars().all()

    if verbose:
        print(
            "Found {} analytics for timestamp={} type={}".format(
                len(participant_analytics), timestamp_value, analytics_type
            )
        )
        if participant_analytics:
            print(row_to_dict(participant_analytics[0]))

    return pd.DataFrame([row_to_dict(item) for item in participant_analytics])


def _filter_buffered_rows_by_timestamp(
    rows: list[dict], timestamp_value
) -> pd.DataFrame:
    matches: list[dict] = []
    for row in rows:
        row_ts = row.get("timestamp")
        if row_ts is None:
            continue
        try:
            row_date = coerce_date(row_ts)
        except (TypeError, ValueError):
            continue
        if row_date == timestamp_value:
            matches.append(row)
    return pd.DataFrame(matches)
