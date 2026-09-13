import pandas as pd
import statistics
from datetime import datetime

from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    ensure_analytics_eligibility,
    filter_dataframe_by_participants,
    is_course_learning_analytics_enabled,
    publish_analytics,
)
from ..research_contribution import (
    contribution_scope_key,
    retain_research_contribution,
)


def compute_weekday_activity(
    db,
    course,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    eligibility = ensure_analytics_eligibility(db, eligibility)
    course_id = course["id"]
    if not is_course_learning_analytics_enabled(db, course_id):
        return None

    eligible_participant_ids = tuple(
        str(participation["participantId"])
        for participation in course["participations"]
        if str(participation["participantId"]) in eligibility.participant_ids
    )
    if not eligible_participant_ids:
        return None

    course_start = course["startDate"].date()
    course_end = course["endDate"].date()
    total_course_participants = len(eligible_participant_ids)

    # fetch all daily participant analytics entries for the course
    daily_analytics = db.participantanalytics.find_many(
        where={
            "type": "DAILY",
            "courseId": course_id,
            "participantId": {"in": list(eligible_participant_ids)},
        },
    )
    df_daily = pd.DataFrame([daily.dict() for daily in daily_analytics])
    df_daily = filter_dataframe_by_participants(df_daily, eligibility)

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

    # original per-participant activity dates feeding the weekday aggregation
    active_dates_by_participant = {}
    for _, row in df_daily.iterrows():
        participant_id = str(row["participantId"])
        active_dates_by_participant.setdefault(participant_id, []).append(row["timestamp"])

    def write(transaction):
        result = transaction.aggregatedcourseanalytics.upsert(
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
        aggregate_id = getattr(result, "id", None)
        for participant_id, active_dates in active_dates_by_participant.items():
            retain_research_contribution(
                transaction,
                family="AGGREGATED_COURSE_ANALYTICS",
                participant_id=participant_id,
                course_id=course_id,
                scope_key=contribution_scope_key(
                    "AGGREGATED_COURSE_ANALYTICS",
                    course_id,
                ),
                scope={
                    "courseId": course_id,
                    "courseStartDate": course_start,
                    "courseEndDate": course_end,
                    "cohortParticipantCount": total_course_participants,
                },
                contributions={
                    "activeDates": active_dates,
                    "activeDays": len(active_dates),
                },
                eligibility=eligibility,
                computed_at=datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z",
                binding="aggregatedCourseAnalyticsId",
                result_row_id=aggregate_id,
            )

    publish_analytics(db, eligibility, (course_id,), write)


def single_weekday_activity(weekdays, df_daily):
    collector = []
    for weekday in weekdays:
        df_weekday = df_daily[df_daily["timestamp"] == pd.Timestamp(weekday).tz_localize("UTC")]

        if df_weekday.empty:
            collector.append(0)

        collector.append(len(df_weekday))

    return statistics.mean(collector) if len(collector) > 0 else 0
