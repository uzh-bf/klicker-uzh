from datetime import datetime


def save_aggregated_analytics(db, df_analytics, timestamp, analytics_type="DAILY"):
    computedAt = datetime.now().strftime("%Y-%m-%d") + "T00:00:00.000Z"

    # create daily / weekly / monthly analytics entries for all participants
    if analytics_type in ["DAILY", "WEEKLY", "MONTHLY"]:
        for _, row in df_analytics.iterrows():
            db.aggregatedanalytics.upsert(
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
                        # TODO: set this value correctly for rolling updates in production code
                        # (cannot be computed for past learning analytics -> therefore set to invalid value)
                        "totalElementsAvailable": -1,
                        "course": {"connect": {"id": row["courseId"]}},
                    },
                    "update": {},
                },
            )

    # create or update course-wide analytics entries (should be unique for participant / course combination)
    elif analytics_type == "COURSE":
        for _, row in df_analytics.iterrows():
            db.aggregatedanalytics.upsert(
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
                        # TODO
                        # ! SET THIS VALUE CORRECTLY - COURSE WIDE IS CURRENTLY AVAILABLE STUFF?!
                        "totalElementsAvailable": -1,
                        "course": {"connect": {"id": row["courseId"]}},
                    },
                    "update": {
                        "computedAt": computedAt,
                        "participantCount": row["participantCount"],
                        "responseCount": row["responseCount"],
                        "totalScore": row["totalScore"],
                        "totalPoints": row["totalPoints"],
                        "totalXp": row["totalXp"],
                        # TODO
                        # ! SET THIS VALUE CORRECTLY - COURSE WIDE IS CURRENTLY AVAILABLE STUFF?!
                        "totalElementsAvailable": -1,
                    },
                },
            )

    else:
        raise ValueError("Unknown analytics type: {}".format(analytics_type))
