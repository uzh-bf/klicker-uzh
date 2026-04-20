from datetime import datetime

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.db_helpers import row_to_dict
from src.models import Course
from src.modules.utils import apply_course_scope, scoped_course_ids


def get_running_past_courses(session: Session) -> pd.DataFrame:
    curr_date = datetime.now()
    scope = scoped_course_ids(session)

    stmt = (
        select(Course)
        .where(Course.startDate <= curr_date)
        .options(selectinload(Course.participations))
    )
    stmt = apply_course_scope(scope, stmt, Course.id)
    if stmt is None:
        print("[get_running_past_courses] empty scope — returning no courses")
        return pd.DataFrame()

    courses = session.execute(stmt).scalars().all()
    rows = []
    for course in courses:
        base = row_to_dict(course)
        base["participations"] = [row_to_dict(p) for p in course.participations]
        rows.append(base)

    df_courses = pd.DataFrame(rows)
    scope_note = f" (scoped to {len(scope)} ids)" if scope is not None else ""
    print(
        f"Found {len(df_courses)} courses with a start date before {curr_date}{scope_note}"
    )
    return df_courses
