import pandas as pd
from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.db_helpers import row_to_dict
from src.models import (
    MicroLearning,
    Participant,
    PracticeQuiz,
    QuestionResponseDetail,
)


def _detail_to_dict(detail: QuestionResponseDetail, participant_id: str) -> dict:
    base = row_to_dict(detail)
    base["participantId"] = participant_id

    if detail.practiceQuiz is not None:
        base["courseId"] = detail.practiceQuiz.courseId
        base["course_start_date"] = detail.practiceQuiz.course.startDate
        base["course_end_date"] = detail.practiceQuiz.course.endDate
    elif detail.microLearning is not None:
        base["courseId"] = detail.microLearning.courseId
        base["course_start_date"] = detail.microLearning.course.startDate
        base["course_end_date"] = detail.microLearning.course.endDate
    else:
        base["courseId"] = None
        base["course_start_date"] = date(9999, 12, 31)
        base["course_end_date"] = date(9999, 12, 31)

    return base


def get_participant_responses(
    session: Session, start_date: str, end_date: str, verbose: bool = False
):
    """Return a dataframe of per-response detail rows for the window.

    ``selectinload`` chains replace the Prisma ``include`` tree with one
    ``IN (...)`` query per relation level — same round-trip count as before.
    """
    participants = session.execute(
        select(Participant).options(
            selectinload(Participant.detailQuestionResponses).options(
                selectinload(QuestionResponseDetail.practiceQuiz).selectinload(
                    PracticeQuiz.course
                ),
                selectinload(QuestionResponseDetail.microLearning).selectinload(
                    MicroLearning.course
                ),
            )
        )
    ).scalars().all()

    start_ts = pd.Timestamp(start_date)
    end_ts = pd.Timestamp(end_date)

    rows = []
    for participant in participants:
        pid = participant.id
        for detail in participant.detailQuestionResponses:
            if detail.createdAt is None:
                continue
            if not (start_ts <= pd.Timestamp(detail.createdAt) <= end_ts):
                continue
            rows.append(_detail_to_dict(detail, pid))

    if verbose:
        print(
            "Found {} detail responses for timespan {}..{}".format(
                len(rows), start_date, end_date
            )
        )

    df_details = pd.DataFrame(rows)
    if df_details.empty:
        return df_details

    df_details = df_details[
        (df_details["createdAt"] >= df_details["course_start_date"])
        & (df_details["createdAt"] <= df_details["course_end_date"])
    ]
    return df_details
