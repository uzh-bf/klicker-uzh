from datetime import datetime


def save_participant_analytics(db, df_analytics, timestamp, analytics_type="DAILY"):
    computedAt = datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z"

    # Create daily / weekly / monthly analytics entries for all participants
    if analytics_type in ["DAILY", "WEEKLY", "MONTHLY"]:
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

    # Create or update course-wide analytics entries (should be unique for participant / course combination)
    elif analytics_type == "COURSE":
        timestamp_const = "1970-01-01T00:00:00.000Z"
        for _, row in df_analytics.iterrows():
            db.participantanalytics.upsert(
                where={
                    "type_courseId_participantId_timestamp": {
                        "type": analytics_type,
                        "courseId": row["courseId"],
                        "participantId": row["participantId"],
                        "timestamp": timestamp_const,
                    }
                },
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

    else:
        raise ValueError("Unknown analytics type: {}".format(analytics_type))
