from sqlalchemy.orm import Session

from src.db_helpers import bulk_upsert, coerce_date, utcnow
from src.models import ParticipantAnalytics


def save_participant_analytics(
    session: Session, df_analytics, timestamp, analytics_type="DAILY"
):
    if df_analytics is None or df_analytics.empty:
        return

    now = utcnow()
    computedAt = now.date()

    if analytics_type in ("DAILY", "WEEKLY", "MONTHLY"):
        ts = coerce_date(timestamp)
        rows = [
            {
                "type": analytics_type,
                "timestamp": ts,
                "computedAt": computedAt,
                "trialsCount": int(row["trialsCount"]),
                "responseCount": int(row["responseCount"]),
                "totalScore": int(row["totalScore"]),
                "totalPoints": int(row["totalPoints"]),
                "totalXp": int(row["totalXp"]),
                "meanCorrectCount": float(row["meanCorrectCount"]),
                "meanPartialCorrectCount": float(row["meanPartialCount"]),
                "meanWrongCount": float(row["meanWrongCount"]),
                "participantId": row["participantId"],
                "courseId": row["courseId"],
                "createdAt": now,
                "updatedAt": now,
            }
            for _, row in df_analytics.iterrows()
        ]
    elif analytics_type == "COURSE":
        ts = coerce_date(timestamp)
        rows = [
            {
                "type": "COURSE",
                "timestamp": ts,
                "computedAt": computedAt,
                "trialsCount": int(row["trialsCount"]),
                "responseCount": int(row["responseCount"]),
                "totalScore": int(row["totalScore"]),
                "totalPoints": int(row["totalPoints"]),
                "totalXp": int(row["totalXp"]),
                "meanCorrectCount": float(row["meanCorrectCount"]),
                "meanPartialCorrectCount": float(row["meanPartialCount"]),
                "meanWrongCount": float(row["meanWrongCount"]),
                "firstCorrectCount": float(row["firstCorrectCount"]),
                "firstWrongCount": float(row["firstWrongCount"]),
                "lastCorrectCount": float(row["lastCorrectCount"]),
                "lastWrongCount": float(row["lastWrongCount"]),
                "participantId": row["participantId"],
                "courseId": row["courseId"],
                "createdAt": now,
                "updatedAt": now,
            }
            for _, row in df_analytics.iterrows()
        ]
    else:
        raise ValueError("Unknown analytics type: {}".format(analytics_type))

    bulk_upsert(
        session,
        ParticipantAnalytics,
        rows,
        conflict_cols=["type", "courseId", "participantId", "timestamp"],
        update_cols=[c for c in rows[0].keys()
                     if c not in ("type", "courseId", "participantId", "timestamp", "createdAt")],
    )
    session.commit()
