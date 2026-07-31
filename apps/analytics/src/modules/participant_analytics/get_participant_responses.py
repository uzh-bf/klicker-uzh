from datetime import datetime

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.db_helpers import coerce_timestamp, row_to_dict
from src.models import (
    Course,
    QuestionResponseDetail,
)

_MISSING_COURSE_START = datetime(1900, 1, 1, 0, 0, 0)
_MISSING_COURSE_END = datetime(2262, 4, 11, 23, 47, 16)


def _coerce_window_bounds(start_date: object, end_date: object) -> tuple[datetime, datetime]:
    return coerce_timestamp(start_date), coerce_timestamp(end_date)


def _load_course_windows(session: Session, course_ids: set[str]) -> dict[str, dict[str, datetime]]:
    if not course_ids:
        return {}

    rows = (
        session.execute(select(Course.id, Course.startDate, Course.endDate).where(Course.id.in_(course_ids)))
        .mappings()
        .all()
    )
    return {
        str(row["id"]): {
            "startDate": coerce_timestamp(row["startDate"]),
            "endDate": coerce_timestamp(row["endDate"]),
        }
        for row in rows
    }


def _detail_to_dict(
    detail: QuestionResponseDetail,
    participant_id: str,
    course_windows: dict[str, dict[str, datetime]],
) -> dict:
    base = row_to_dict(detail)
    base["participantId"] = participant_id
    base["createdAt"] = coerce_timestamp(base["createdAt"])

    if detail.practiceQuiz is not None:
        course_id = str(detail.practiceQuiz.courseId)
        course_window = course_windows.get(course_id)
        base["courseId"] = course_id
        base["course_start_date"] = (
            coerce_timestamp(course_window["startDate"]) if course_window else _MISSING_COURSE_START
        )
        base["course_end_date"] = coerce_timestamp(course_window["endDate"]) if course_window else _MISSING_COURSE_END
    elif detail.microLearning is not None:
        course_id = str(detail.microLearning.courseId)
        course_window = course_windows.get(course_id)
        base["courseId"] = course_id
        base["course_start_date"] = (
            coerce_timestamp(course_window["startDate"]) if course_window else _MISSING_COURSE_START
        )
        base["course_end_date"] = coerce_timestamp(course_window["endDate"]) if course_window else _MISSING_COURSE_END
    else:
        base["courseId"] = None
        base["course_start_date"] = _MISSING_COURSE_START
        base["course_end_date"] = _MISSING_COURSE_END

    return base


def get_participant_responses(session: Session, start_date: str, end_date: str, verbose: bool = False):
    """Return a dataframe of per-response detail rows for the window.

    The time predicate stays in Postgres so the ``createdAt`` BRIN index can
    prune the append-mostly detail table before relationships are loaded.
    """
    start_ts, end_ts = _coerce_window_bounds(start_date, end_date)
    details = (
        session.execute(
            select(QuestionResponseDetail)
            .where(
                QuestionResponseDetail.createdAt >= start_ts,
                QuestionResponseDetail.createdAt <= end_ts,
            )
            .options(
                selectinload(QuestionResponseDetail.practiceQuiz),
                selectinload(QuestionResponseDetail.microLearning),
            )
        )
        .scalars()
        .all()
    )

    course_ids = {
        str(detail.practiceQuiz.courseId)
        for detail in details
        if detail.practiceQuiz is not None and detail.practiceQuiz.courseId is not None
    } | {
        str(detail.microLearning.courseId)
        for detail in details
        if detail.microLearning is not None and detail.microLearning.courseId is not None
    }
    course_windows = _load_course_windows(session, course_ids)

    rows = []
    for detail in details:
        rows.append(_detail_to_dict(detail, str(detail.participantId), course_windows))

    if verbose:
        print("Found {} detail responses for timespan {}..{}".format(len(rows), start_date, end_date))

    df_details = pd.DataFrame(rows)
    if df_details.empty:
        return df_details

    df_details = df_details[
        (df_details["createdAt"] >= df_details["course_start_date"])
        & (df_details["createdAt"] <= df_details["course_end_date"])
    ]
    return df_details
