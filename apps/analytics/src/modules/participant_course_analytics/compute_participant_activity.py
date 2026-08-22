import pandas as pd


def compute_participant_activity(db, df_activity, course_id, course_start, course_end):
    # compute course duration in days
    course_duration = (course_end - course_start).days + 1
    week_end_dates = pd.date_range(start=course_start, end=course_end, freq="W")

    # loop over the activity analytics tracking dataframe
    for idx, row in df_activity.iterrows():
        participant_id = row["participantId"]

        # get all daily participant analytics entries for the participant
        daily_analytics = db.participantanalytics.find_many(
            where={
                "type": "DAILY",
                "courseId": course_id,
                "participantId": participant_id,
            },
        )

        # compute the mean elements answered per day based on the daily analytics response count
        response_count = sum([dict(daily)["responseCount"] for daily in daily_analytics])
        df_activity.loc[idx, "meanElementsPerDay"] = response_count / course_duration

        # compute average active days per week
        active_days_week = []

        # if course lasts for less than one week, imitate a course duration of one week
        if (course_duration) <= 7:
            # filter the daily analytics entries for the current week
            week_analytics = sum_active_days_per_week(course_end, daily_analytics)

            # add the number of active days per week to the list
            active_days_week.append(len(week_analytics))

        else:
            for week_end in week_end_dates:
                # filter the daily analytics entries for the current week
                week_analytics = sum_active_days_per_week(week_end, daily_analytics)

                # ? first and last week might not be complete weeks - could be treated differently here for maximum precision of results
                # add the number of active days per week to the list
                active_days_week.append(len(week_analytics))

        # compute the average active days per week
        df_activity.loc[idx, "activeDaysPerWeek"] = sum(active_days_week) / len(active_days_week)

    return df_activity


def sum_active_days_per_week(week_end, daily_analytics):
    week_start = week_end - pd.DateOffset(days=6)

    # filter the daily analytics entries for the current week
    week_analytics = list(
        filter(
            lambda daily: week_start <= dict(daily)["timestamp"] <= week_end,
            daily_analytics,
        )
    )

    return week_analytics
