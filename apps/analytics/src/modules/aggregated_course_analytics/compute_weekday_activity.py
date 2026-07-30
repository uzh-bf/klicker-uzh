import pandas as pd
import statistics


def compute_weekday_activity(db, course):
    course_id = course["id"]
    course_start = course["startDate"].date()
    course_end = course["endDate"].date()
    total_course_participants = len(course["participations"])

    # fetch all daily participant analytics entries for the course
    daily_analytics = db.participantanalytics.find_many(
        where={
            "type": "DAILY",
            "courseId": course_id,
        },
    )
    df_daily = pd.DataFrame([daily.dict() for daily in daily_analytics])

    if df_daily.empty:
        return None

    # compute date ranges with specific weekdays only
    mondays = pd.date_range(
        start=course_start,
        end=pd.Timestamp(course_end) + pd.tseries.offsets.DateOffset(days=1),
        freq="W-MON",
    )
    tuesdays = pd.date_range(
        start=course_start,
        end=pd.Timestamp(course_end) + pd.tseries.offsets.DateOffset(days=1),
        freq="W-TUE",
    )
    wednesdays = pd.date_range(
        start=course_start,
        end=pd.Timestamp(course_end) + pd.tseries.offsets.DateOffset(days=1),
        freq="W-WED",
    )
    thursdays = pd.date_range(
        start=course_start,
        end=pd.Timestamp(course_end) + pd.tseries.offsets.DateOffset(days=1),
        freq="W-THU",
    )
    fridays = pd.date_range(
        start=course_start,
        end=pd.Timestamp(course_end) + pd.tseries.offsets.DateOffset(days=1),
        freq="W-FRI",
    )
    saturdays = pd.date_range(
        start=course_start,
        end=pd.Timestamp(course_end) + pd.tseries.offsets.DateOffset(days=1),
        freq="W-SAT",
    )
    sundays = pd.date_range(
        start=course_start,
        end=pd.Timestamp(course_end) + pd.tseries.offsets.DateOffset(days=1),
        freq="W-SUN",
    )

    activity_monday = single_weekday_activity(mondays, df_daily)
    activity_tuesday = single_weekday_activity(tuesdays, df_daily)
    activity_wednesday = single_weekday_activity(wednesdays, df_daily)
    activity_thursday = single_weekday_activity(thursdays, df_daily)
    activity_friday = single_weekday_activity(fridays, df_daily)
    activity_saturday = single_weekday_activity(saturdays, df_daily)
    activity_sunday = single_weekday_activity(sundays, df_daily)

    # save the result to the database
    db.aggregatedcourseanalytics.upsert(
        where={"courseId": course_id},
        data={
            "create": {
                "courseParticipantCount": total_course_participants,
                "activityMonday": activity_monday,
                "activityTuesday": activity_tuesday,
                "activityWednesday": activity_wednesday,
                "activityThursday": activity_thursday,
                "activityFriday": activity_friday,
                "activitySaturday": activity_saturday,
                "activitySunday": activity_sunday,
                "course": {"connect": {"id": course_id}},
            },
            "update": {
                "courseParticipantCount": total_course_participants,
                "activityMonday": activity_monday,
                "activityTuesday": activity_tuesday,
                "activityWednesday": activity_wednesday,
                "activityThursday": activity_thursday,
                "activityFriday": activity_friday,
                "activitySaturday": activity_saturday,
                "activitySunday": activity_sunday,
            },
        },
    )


def single_weekday_activity(weekdays, df_daily):
    collector = []
    for weekday in weekdays:
        df_weekday = df_daily[df_daily["timestamp"] == pd.Timestamp(weekday).tz_localize("UTC")]

        if df_weekday.empty:
            collector.append(0)

        collector.append(len(df_weekday))

    return statistics.mean(collector) if len(collector) > 0 else 0
