def save_instance_performances(db, df_instance_performance, course_id):
    for _, row in df_instance_performance.iterrows():
        db.instanceperformance.upsert(
            where={
                "instanceId": row["instanceId"],
            },
            data={
                "create": {
                    "responseCount": row["responseCount"],
                    "firstErrorRate": row["firstErrorRate"],
                    "firstPartialRate": row["firstPartialRate"],
                    "firstCorrectRate": row["firstCorrectRate"],
                    "lastErrorRate": row["lastErrorRate"],
                    "lastPartialRate": row["lastPartialRate"],
                    "lastCorrectRate": row["lastCorrectRate"],
                    "totalErrorRate": row["totalErrorRate"],
                    "totalPartialRate": row["totalPartialRate"],
                    "totalCorrectRate": row["totalCorrectRate"],
                    "instance": {"connect": {"id": row["instanceId"]}},
                    "course": {"connect": {"id": course_id}},
                },
                "update": {
                    "responseCount": row["responseCount"],
                    "firstErrorRate": row["firstErrorRate"],
                    "firstPartialRate": row["firstPartialRate"],
                    "firstCorrectRate": row["firstCorrectRate"],
                    "lastErrorRate": row["lastErrorRate"],
                    "lastPartialRate": row["lastPartialRate"],
                    "lastCorrectRate": row["lastCorrectRate"],
                    "totalErrorRate": row["totalErrorRate"],
                    "totalPartialRate": row["totalPartialRate"],
                    "totalCorrectRate": row["totalCorrectRate"],
                },
            },
        )
