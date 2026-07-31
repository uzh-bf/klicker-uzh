from collections import defaultdict
from datetime import datetime

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import Course, Participation
from src.modules.utils import apply_course_scope, scoped_course_ids


def get_running_past_courses(session: Session) -> pd.DataFrame:
    curr_date = datetime.now()
    scope = scoped_course_ids(session)

    stmt = select(Course.id, Course.startDate, Course.endDate).where(Course.startDate <= curr_date)
    stmt = apply_course_scope(scope, stmt, Course.id)
    if stmt is None:
        print("[get_running_past_courses] empty scope — returning no courses")
        return pd.DataFrame()

    courses = [dict(row) for row in session.execute(stmt).mappings().all()]
    course_ids = [str(course["id"]) for course in courses]

    participations_by_course: dict[str, list[dict[str, object]]] = defaultdict(list)
    if course_ids:
        participation_rows = session.execute(
            select(Participation.courseId, Participation.participantId).where(Participation.courseId.in_(course_ids))
        ).mappings()
        for row in participation_rows:
            participations_by_course[str(row["courseId"])].append({"participantId": row["participantId"]})

    rows = []
    for course in courses:
        base = dict(course)
        base["participations"] = participations_by_course.get(str(course["id"]), [])
        rows.append(base)

    df_courses = pd.DataFrame(rows)
    scope_note = f" (scoped to {len(scope)} ids)" if scope is not None else ""
    print(f"Found {len(df_courses)} courses with a start date before {curr_date}{scope_note}")
    return df_courses
