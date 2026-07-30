from datetime import datetime
import pandas as pd

from src.modules.utils import apply_course_scope, scoped_course_ids


def get_running_past_courses(db):
    curr_date = datetime.now().strftime("%Y-%m-%d")
    scope = scoped_course_ids(db)
    where = apply_course_scope(
        {"startDate": {"lte": curr_date + "T23:59:59.999Z"}},
        scope,
    )
    if where is None:
        print("[get_running_past_courses] empty scope — returning no courses")
        return pd.DataFrame()

    courses = db.course.find_many(where=where, include={"participations": True})
    df_courses = pd.DataFrame(list(map(lambda x: x.dict(), courses)))
    scope_note = f" (scoped to {len(scope)} ids)" if scope is not None else ""
    print(f"Found {len(df_courses)} courses with a start date before {curr_date}{scope_note}")
    return df_courses
