from datetime import datetime

from ..analytics_eligibility import AnalyticsEligibilityContext, publish_analytics
from ..research_contribution import (
    contribution_scope_key,
    retain_research_contribution,
)


def save_aggregated_analytics(
    db,
    df_analytics,
    timestamp,
    analytics_type="DAILY",
    eligibility: AnalyticsEligibilityContext | None = None,
    df_participant=None,
    source_window_start=None,
    source_window_end=None,
):
    if df_analytics.empty:
        return
    if analytics_type not in ["DAILY", "WEEKLY", "MONTHLY", "COURSE"]:
        raise ValueError("Unknown analytics type: {}".format(analytics_type))

    computedAt = datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z"
    course_ids = tuple(dict.fromkeys(str(course_id) for course_id in df_analytics["courseId"].dropna()))
    participant_rows = {} if df_participant is None else {
        str(course_id): rows
        for course_id, rows in df_participant.groupby("courseId")
    } if not df_participant.empty else {}

    def retain_course_contributions(transaction, row, aggregate_id, scope_timestamp):
        for _, participant_row in participant_rows.get(str(row["courseId"]), []).iterrows():
            retain_research_contribution(
                transaction,
                family="AGGREGATED_ANALYTICS",
                participant_id=participant_row["participantId"],
                course_id=row["courseId"],
                scope_key=contribution_scope_key(
                    "AGGREGATED_ANALYTICS",
                    row["courseId"],
                    analytics_type,
                    scope_timestamp,
                ),
                scope={
                    "courseId": row["courseId"],
                    "type": analytics_type,
                    "timestamp": scope_timestamp,
                },
                contributions={
                    "trialsCount": participant_row["trialsCount"],
                    "responseCount": participant_row["responseCount"],
                    "totalScore": participant_row["totalScore"],
                    "totalPoints": participant_row["totalPoints"],
                    "totalXp": participant_row["totalXp"],
                },
                eligibility=eligibility,
                computed_at=computedAt,
                binding="aggregatedAnalyticsId",
                result_row_id=aggregate_id,
                source_window_start=source_window_start,
                source_window_end=source_window_end,
            )

    def write(transaction):
        # create daily / weekly / monthly analytics entries for all participants
        if analytics_type in ["DAILY", "WEEKLY", "MONTHLY"]:
            for _, row in df_analytics.iterrows():
                where = {
                    "type_courseId_timestamp": {
                        "type": analytics_type,
                        "courseId": row["courseId"],
                        "timestamp": timestamp,
                    }
                }
                # Rolling window aggregates keep their original values on
                # re-runs (update: {}); contributions are retained only when
                # the aggregate row is first created.
                existing = transaction.aggregatedanalytics.find_unique(where=where)
                transaction.aggregatedanalytics.upsert(
                    where=where,
                    data={
                        "create": {
                            "type": analytics_type,
                            "timestamp": timestamp,
                            "computedAt": computedAt,
                            "participantCount": row["participantCount"],
                            "responseCount": row["responseCount"],
                            "totalScore": row["totalScore"],
                            "totalPoints": row["totalPoints"],
                            "totalXp": row["totalXp"],
                            # TODO: set this value correctly for rolling updates in production code
                            # (cannot be computed for past learning analytics -> therefore set to invalid value)
                            "totalElementsAvailable": -1,
                            "course": {"connect": {"id": row["courseId"]}},
                        },
                        "update": {},
                    },
                )
                if existing is None:
                    result = transaction.aggregatedanalytics.find_unique(where=where)
                    retain_course_contributions(
                        transaction,
                        row,
                        None if result is None else result.id,
                        timestamp,
                    )

        # create or update course-wide aggregated analytics entries
        elif analytics_type == "COURSE":
            for _, row in df_analytics.iterrows():
                course = transaction.course.find_unique_or_raise(
                    where={"id": row["courseId"]},
                    include={
                        "practiceQuizzes": {
                            "include": {
                                "stacks": {
                                    "include": {"elements": True},
                                }
                            }
                        },
                        "microLearnings": {
                            "include": {
                                "stacks": {
                                    "include": {"elements": True},
                                }
                            }
                        },
                    },
                )
                course = dict(course)

                # add all the number of elements in all practice quizzes and microlearnings together
                totalElementsAvailable = 0
                for practice_quiz in course["practiceQuizzes"]:
                    pq_dict = dict(practice_quiz)
                    for stack in pq_dict["stacks"]:
                        stack_dict = dict(stack)
                        totalElementsAvailable += len(stack_dict["elements"])
                for microlearning in course["microLearnings"]:
                    ml_dict = dict(microlearning)
                    for stack in ml_dict["stacks"]:
                        stack_dict = dict(stack)
                        totalElementsAvailable += len(stack_dict["elements"])

                result = transaction.aggregatedanalytics.upsert(
                    where={
                        "type_courseId_timestamp": {
                            "type": analytics_type,
                            "courseId": row["courseId"],
                            "timestamp": timestamp,
                        }
                    },
                    data={
                        "create": {
                            "type": analytics_type,
                            "timestamp": timestamp,
                            "computedAt": computedAt,
                            "participantCount": row["participantCount"],
                            "responseCount": row["responseCount"],
                            "totalScore": row["totalScore"],
                            "totalPoints": row["totalPoints"],
                            "totalXp": row["totalXp"],
                            "totalElementsAvailable": totalElementsAvailable,
                            "course": {"connect": {"id": row["courseId"]}},
                        },
                        "update": {
                            "computedAt": computedAt,
                            "participantCount": row["participantCount"],
                            "responseCount": row["responseCount"],
                            "totalScore": row["totalScore"],
                            "totalPoints": row["totalPoints"],
                            "totalXp": row["totalXp"],
                            "totalElementsAvailable": totalElementsAvailable,
                        },
                    },
                )
                retain_course_contributions(
                    transaction,
                    row,
                    getattr(result, "id", None),
                    timestamp,
                )

    publish_analytics(db, eligibility, course_ids, write)
