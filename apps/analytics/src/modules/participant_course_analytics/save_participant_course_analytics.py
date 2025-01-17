def save_participant_course_analytics(db, df_activity):
    for _, row in df_activity.iterrows():
        db.participantcourseanalytics.upsert(
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
