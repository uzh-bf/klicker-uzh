from ..analytics_eligibility import (
    AnalyticsEligibilityContext,
    AnalyticsEligibilityRequired,
    filter_dataframe_by_participants,
    publish_analytics,
)


def save_participant_activity_performance(
    db,
    df_activity_performance,
    activity_type,
    course_id=None,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    if df_activity_performance.empty:
        return
    if course_id is None:
        raise ValueError("course_id is required for participant activity publication")
    if eligibility is None:
        raise AnalyticsEligibilityRequired("Analytics publication requires an eligibility context")

    df_activity_performance = filter_dataframe_by_participants(
        df_activity_performance,
        eligibility,
    )
    if df_activity_performance.empty:
        return

    def write(transaction):
        for _, row in df_activity_performance.iterrows():
            creation_values = {
                "totalScore": row["totalScore"],
                "completion": row["completion"],
                "participant": {"connect": {"id": row["participantId"]}},
            }
            update_values = {
                "totalScore": row["totalScore"],
                "completion": row["completion"],
            }

            if activity_type == "practiceQuizzes":
                creation_values["practiceQuiz"] = {"connect": {"id": row["activityId"]}}
                transaction.participantactivityperformance.upsert(
                    where={
                        "participantId_practiceQuizId": {
                            "participantId": row["participantId"],
                            "practiceQuizId": row["activityId"],
                        }
                    },
                    data={"create": creation_values, "update": update_values},
                )

            elif activity_type == "microLearnings":
                creation_values["microLearning"] = {"connect": {"id": row["activityId"]}}
                transaction.participantactivityperformance.upsert(
                    where={
                        "participantId_microLearningId": {
                            "participantId": row["participantId"],
                            "microLearningId": row["activityId"],
                        }
                    },
                    data={"create": creation_values, "update": update_values},
                )

            else:
                raise ValueError("Unknown activity type: {}".format(activity_type))

    publish_analytics(db, eligibility, (course_id,), write)
