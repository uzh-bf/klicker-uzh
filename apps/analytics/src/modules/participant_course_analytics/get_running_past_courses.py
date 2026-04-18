from datetime import datetime
import pandas as pd

from src.modules.utils import scoped_course_ids


def get_running_past_courses(db):
    curr_date = datetime.now().strftime("%Y-%m-%d")
    where: dict = {
        "startDate": {"lte": curr_date + "T23:59:59.999Z"},
    }

    scope = scoped_course_ids(db)
    if scope is not None:
        if not scope:
            print("[get_running_past_courses] empty scope — returning no courses")
            return pd.DataFrame()
        where["id"] = {"in": scope}

    courses = db.course.find_many(
        where=where,
        include={"participations": True},
    )

    df_courses = pd.DataFrame(list(map(lambda x: x.dict(), courses)))
    scope_note = f" (scoped to {len(scope)} ids)" if scope is not None else ""
    print(
        "Found {} courses with a start date before {}{}".format(
            len(df_courses), curr_date, scope_note
        )
    )

    return df_courses
