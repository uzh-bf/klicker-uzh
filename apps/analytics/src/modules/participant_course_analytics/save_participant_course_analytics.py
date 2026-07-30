from src.modules.learning_analytics_eligibility import learning_analytics_write_transaction


def save_participant_course_analytics(db, df_activity):
    for _, row in df_activity.iterrows():
        with learning_analytics_write_transaction(
            db,
            course_id=row["courseId"],
            participant_id=row["participantId"],
        ) as transaction:
            if transaction is None:
                continue
            transaction.participantcourseanalytics.upsert(
                where={
                    "courseId_participantId": {
                        "courseId": row["courseId"],
                        "participantId": row["participantId"],
                    }
                },
                data={
                    "create": {
                        "activeWeeks": row["activeWeeks"],
                        "activeDaysPerWeek": row["activeDaysPerWeek"],
                        "meanElementsPerDay": row["meanElementsPerDay"],
                        "activityLevel": row["activityLevel"],
                        "course": {"connect": {"id": row["courseId"]}},
                        "participant": {"connect": {"id": row["participantId"]}},
                    },
                    "update": {
                        "activeWeeks": row["activeWeeks"],
                        "activeDaysPerWeek": row["activeDaysPerWeek"],
                        "meanElementsPerDay": row["meanElementsPerDay"],
                        "activityLevel": row["activityLevel"],
                    },
                },
            )
