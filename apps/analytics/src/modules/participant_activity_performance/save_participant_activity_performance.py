def save_participant_activity_performance(db, df_activity_performance, activity_type):
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
            db.participantactivityperformance.upsert(
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
            db.participantactivityperformance.upsert(
                where={
                    "participantId_microLearningId": {
                        "participantId": row["participantId"],
                        "microLearningId": row["activityId"],
                    }
                },
                data={"create": creation_values, "update": update_values},
            )
