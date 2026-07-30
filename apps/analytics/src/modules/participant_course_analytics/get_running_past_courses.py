from datetime import datetime
import pandas as pd
from src.modules.learning_analytics_eligibility import (
    LEARNING_ANALYTICS_DISCLOSURE_VERSION,
    is_learning_analytics_rollout_enabled,
)


def get_running_past_courses(db):
    curr_date = datetime.now().strftime("%Y-%m-%d")
    if not is_learning_analytics_rollout_enabled():
        return pd.DataFrame()

    courses = db.course.find_many(
        where={
            "isLearningAnalyticsEnabled": True,
            # Incremental scripts can add this statement to reduce the amount of required computations
            # 'endDate': {
            #     'gt': datetime.now().strftime('%Y-%m-%d') + 'T00:00:00.000Z'
            # }
            "startDate": {"lte": curr_date + "T23:59:59.999Z"},
        },
        include={
            "participations": {
                "where": {
                    "learningAnalyticsStatus": "INCLUDED",
                    "learningAnalyticsDisclosureVersion": LEARNING_ANALYTICS_DISCLOSURE_VERSION,
                    "learningAnalyticsIncludedFrom": {"not": None},
                }
            }
        },
    )

    df_courses = pd.DataFrame(list(map(lambda x: x.dict(), courses)))
    print("Found {} courses with a start date before {}".format(len(df_courses), curr_date))

    return df_courses
