import pandas as pd


def get_active_weeks(db, course):
    course_id = course["id"]
    participations = course["participations"]

    # initialize pandas dataframe to store the participant activity
    df_activity = pd.DataFrame(columns=["participantId", "courseId", "activeWeeks"])

    # iterate over all participants in the course and count the number of weekly participant analytics entries
    for participation in participations:
        participant_id = participation["participantId"]
        weekly_analytics = db.participantanalytics.find_many(
            where={
                "type": "WEEKLY",
                "courseId": course_id,
                "participantId": participant_id,
            },
        )

        active_weeks = len(weekly_analytics)

        # store data in the dataframe
        df_activity.loc[len(df_activity)] = {
            "participantId": participant_id,
            "courseId": course_id,
            "activeWeeks": active_weeks,
        }

    return df_activity
