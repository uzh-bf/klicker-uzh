def save_participant_analytics(db, df_analytics, timestamp, analytics_type="DAILY"):
    # Create daily analytics entries for all participants
    for _, row in df_analytics.iterrows():
        db.participantanalytics.upsert(
            where={
                "type_courseId_participantId_timestamp": {
                    "type": analytics_type,
                    "courseId": row["courseId"],
                    "participantId": row["participantId"],
                    "timestamp": timestamp,
                }
            },
            data={
                "create": {
                    "type": analytics_type,
                    "timestamp": timestamp,
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
