from datetime import datetime
import pandas as pd


def get_running_past_courses(db):
    curr_date = datetime.now().strftime("%Y-%m-%d")
    courses = db.course.find_many(
        where={
            "isDeleted": False,
            "isDeletionPending": False,
            # Incremental scripts can add this statement to reduce the amount of required computations
            # 'endDate': {
            #     'gt': datetime.now().strftime('%Y-%m-%d') + 'T00:00:00.000Z'
            # }
            "startDate": {"lte": curr_date + "T23:59:59.999Z"},
        },
        include={"participations": True},
    )

    df_courses = pd.DataFrame(list(map(lambda x: x.dict(), courses)))
    print("Found {} courses with a start date before {}".format(len(df_courses), curr_date))

    return df_courses
