from datetime import datetime

from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    AnalyticsEligibilityRequired,
    filter_dataframe_by_participants,
    publish_analytics,
)
from ..research_contribution import (
    contribution_scope_key,
    retain_research_contribution,
)


def save_participant_analytics(
    db,
    df_analytics,
    timestamp,
    analytics_type="DAILY",
    eligibility: AnalyticsEligibilityContext | None = None,
    source_window_start=None,
    source_window_end=None,
):
    if df_analytics.empty:
        return
    if analytics_type not in ["DAILY", "WEEKLY", "MONTHLY", "COURSE"]:
        raise ValueError("Unknown analytics type: {}".format(analytics_type))
    if eligibility is None:
        raise AnalyticsEligibilityRequired("Analytics publication requires an eligibility context")

    df_analytics = filter_dataframe_by_participants(df_analytics, eligibility)
    if df_analytics.empty:
        return

    computedAt = datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z"
    course_ids = tuple(dict.fromkeys(str(course_id) for course_id in df_analytics["courseId"].dropna()))

    def base_contribution(row):
        return {
            "trialsCount": row["trialsCount"],
            "responseCount": row["responseCount"],
            "totalScore": row["totalScore"],
            "totalPoints": row["totalPoints"],
            "totalXp": row["totalXp"],
            "meanCorrectCount": row["meanCorrectCount"],
            "meanPartialCorrectCount": row["meanPartialCount"],
            "meanWrongCount": row["meanWrongCount"],
        }

    def write(transaction):
        # Create daily / weekly / monthly analytics entries for all participants
        if analytics_type in ["DAILY", "WEEKLY", "MONTHLY"]:
            for _, row in df_analytics.iterrows():
                where = {
                    "type_courseId_participantId_timestamp": {
                        "type": analytics_type,
                        "courseId": row["courseId"],
                        "participantId": row["participantId"],
                        "timestamp": timestamp,
                    }
                }
                # Rolling window rows keep their original values on re-runs
                # (update: {}); contributions are retained only for newly
                # created rows so provenance reflects the first publication.
                existing = transaction.participantanalytics.find_unique(where=where)
                transaction.participantanalytics.upsert(
                    where=where,
                    data={
                        "create": {
                            "type": analytics_type,
                            "timestamp": timestamp,
                            "computedAt": computedAt,
                            "trialsCount": row["trialsCount"],
                            "responseCount": row["responseCount"],
                            "totalScore": row["totalScore"],
                            "totalPoints": row["totalPoints"],
                            "totalXp": row["totalXp"],
                            "meanCorrectCount": row["meanCorrectCount"],
                            "meanPartialCorrectCount": row["meanPartialCount"],
                            "meanWrongCount": row["meanWrongCount"],
                            "participant": {"connect": {"id": row["participantId"]}},
                            "course": {"connect": {"id": row["courseId"]}},
                        },
                        "update": {},
                    },
                )
                if existing is None:
                    result = transaction.participantanalytics.find_unique(where=where)
                    retain_research_contribution(
                        transaction,
                        family="PARTICIPANT_ANALYTICS",
                        participant_id=row["participantId"],
                        course_id=row["courseId"],
                        scope_key=contribution_scope_key(
                            "PARTICIPANT_ANALYTICS",
                            row["courseId"],
                            analytics_type,
                            timestamp,
                        ),
                        scope={
                            "courseId": row["courseId"],
                            "type": analytics_type,
                            "timestamp": timestamp,
                        },
                        contributions=base_contribution(row),
                        eligibility=eligibility,
                        computed_at=computedAt,
                        binding="participantAnalyticsId",
                        result_row_id=None if result is None else result.id,
                        source_window_start=source_window_start,
                        source_window_end=source_window_end,
                    )

        # Create or update course-wide analytics entries (should be unique for participant / course combination)
        elif analytics_type == "COURSE":
            timestamp_const = "1970-01-01T00:00:00.000Z"
            for _, row in df_analytics.iterrows():
                where = {
                    "type_courseId_participantId_timestamp": {
                        "type": analytics_type,
                        "courseId": row["courseId"],
                        "participantId": row["participantId"],
                        "timestamp": timestamp_const,
                    }
                }
                transaction.participantanalytics.upsert(
                    where=where,
                    data={
                        "create": {
                            "type": "COURSE",
                            "timestamp": timestamp_const,
                            "computedAt": computedAt,
                            "trialsCount": row["trialsCount"],
                            "responseCount": row["responseCount"],
                            "totalScore": row["totalScore"],
                            "totalPoints": row["totalPoints"],
                            "totalXp": row["totalXp"],
                            "meanCorrectCount": row["meanCorrectCount"],
                            "meanPartialCorrectCount": row["meanPartialCount"],
                            "meanWrongCount": row["meanWrongCount"],
                            "firstCorrectCount": row["firstCorrectCount"],
                            "firstWrongCount": row["firstWrongCount"],
                            "lastCorrectCount": row["lastCorrectCount"],
                            "lastWrongCount": row["lastWrongCount"],
                            "participant": {"connect": {"id": row["participantId"]}},
                            "course": {"connect": {"id": row["courseId"]}},
                        },
                        "update": {
                            "timestamp": timestamp_const,
                            "computedAt": computedAt,
                            "trialsCount": row["trialsCount"],
                            "responseCount": row["responseCount"],
                            "totalScore": row["totalScore"],
                            "totalPoints": row["totalPoints"],
                            "totalXp": row["totalXp"],
                            "meanCorrectCount": row["meanCorrectCount"],
                            "meanPartialCorrectCount": row["meanPartialCount"],
                            "meanWrongCount": row["meanWrongCount"],
                            "firstCorrectCount": row["firstCorrectCount"],
                            "firstWrongCount": row["firstWrongCount"],
                            "lastCorrectCount": row["lastCorrectCount"],
                            "lastWrongCount": row["lastWrongCount"],
                        },
                    },
                )
                result = transaction.participantanalytics.find_unique(where=where)
                contributions = base_contribution(row)
                contributions.update(
                    {
                        "firstCorrectCount": row["firstCorrectCount"],
                        "firstWrongCount": row["firstWrongCount"],
                        "lastCorrectCount": row["lastCorrectCount"],
                        "lastWrongCount": row["lastWrongCount"],
                    }
                )
                retain_research_contribution(
                    transaction,
                    family="PARTICIPANT_ANALYTICS",
                    participant_id=row["participantId"],
                    course_id=row["courseId"],
                    scope_key=contribution_scope_key(
                        "PARTICIPANT_ANALYTICS",
                        row["courseId"],
                        analytics_type,
                    ),
                    scope={
                        "courseId": row["courseId"],
                        "type": analytics_type,
                    },
                    contributions=contributions,
                    eligibility=eligibility,
                    computed_at=computedAt,
                    binding="participantAnalyticsId",
                    result_row_id=None if result is None else result.id,
                    source_window_start=source_window_start,
                    source_window_end=source_window_end,
                )

    publish_analytics(db, eligibility, course_ids, write)
