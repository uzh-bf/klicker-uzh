from src.modules.learning_analytics_eligibility import learning_analytics_write_transaction


def save_participant_performance(db, df_performance, course_id):
    for _, row in df_performance.iterrows():
        with learning_analytics_write_transaction(
            db,
            course_id=course_id,
            participant_id=row["participantId"],
        ) as transaction:
            if transaction is None:
                continue
            transaction.participantperformance.upsert(
                where={
                    "participantId_courseId": {
                        "participantId": row["participantId"],
                        "courseId": course_id,
                    }
                },
                data={
                    "create": {
                        "firstErrorRate": row["firstErrorRate"],
                        "firstPerformance": row["firstPerformance"],
                        "lastErrorRate": row["lastErrorRate"],
                        "lastPerformance": row["lastPerformance"],
                        "totalErrorRate": row["totalErrorRate"],
                        "totalPerformance": row["totalPerformance"],
                        "participant": {"connect": {"id": row["participantId"]}},
                        "course": {"connect": {"id": course_id}},
                    },
                    "update": {
                        "firstErrorRate": row["firstErrorRate"],
                        "firstPerformance": row["firstPerformance"],
                        "lastErrorRate": row["lastErrorRate"],
                        "lastPerformance": row["lastPerformance"],
                        "totalErrorRate": row["totalErrorRate"],
                        "totalPerformance": row["totalPerformance"],
                    },
                },
            )
