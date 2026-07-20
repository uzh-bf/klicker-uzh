def save_instance_performances(db, df_instance_performance, course_id, total_only=False):
    for _, row in df_instance_performance.iterrows():
        # extract values from dataframe
        values = {
            "responseCount": row["responseCount"],
            "totalErrorRate": row["totalErrorRate"],
            "totalPartialRate": row["totalPartialRate"],
            "totalCorrectRate": row["totalCorrectRate"],
            "averageTimeSpent": row["averageTimeSpent"],
        }

        # only define first and last response rates if applicable
        if not total_only:
            values.update(
                {
                    "firstErrorRate": row["firstErrorRate"],
                    "firstPartialRate": row["firstPartialRate"],
                    "firstCorrectRate": row["firstCorrectRate"],
                    "lastErrorRate": row["lastErrorRate"],
                    "lastPartialRate": row["lastPartialRate"],
                    "lastCorrectRate": row["lastCorrectRate"],
                }
            )

        # add relational links during creation
        create_values = values.copy()
        create_values.update(
            {
                "instance": {"connect": {"id": row["instanceId"]}},
                "course": {"connect": {"id": course_id}},
            }
        )

        db.instanceperformance.upsert(
            where={
                "instanceId": row["instanceId"],
            },
            data={
                "create": create_values,
                "update": values,
            },
        )
