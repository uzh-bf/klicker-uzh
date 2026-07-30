from datetime import datetime

from sqlalchemy.orm import Session

from src.db_helpers import bulk_upsert
from src.models import InstancePerformance
from src.modules.learning_analytics_eligibility import (
    filter_learning_analytics_rows_for_write,
)


def save_instance_performances(session: Session, df_instance_performance, course_id: str, total_only: bool = False):
    if df_instance_performance is None or df_instance_performance.empty:
        return

    now = datetime.now()
    rows = []
    for _, row in df_instance_performance.iterrows():
        values = {
            "responseCount": int(row["responseCount"]),
            "totalErrorRate": float(row["totalErrorRate"]),
            "totalPartialRate": float(row["totalPartialRate"]),
            "totalCorrectRate": float(row["totalCorrectRate"]),
            "averageTimeSpent": float(row["averageTimeSpent"]),
            "instanceId": int(row["instanceId"]),
            "courseId": course_id,
            "createdAt": now,
            "updatedAt": now,
        }
        if not total_only:
            values.update(
                {
                    "firstErrorRate": float(row["firstErrorRate"]),
                    "firstPartialRate": float(row["firstPartialRate"]),
                    "firstCorrectRate": float(row["firstCorrectRate"]),
                    "lastErrorRate": float(row["lastErrorRate"]),
                    "lastPartialRate": float(row["lastPartialRate"]),
                    "lastCorrectRate": float(row["lastCorrectRate"]),
                }
            )
        rows.append(values)

    rows = filter_learning_analytics_rows_for_write(session, rows)
    if not rows:
        session.rollback()
        return
    update_cols = [c for c in rows[0].keys() if c not in ("instanceId", "createdAt")]
    bulk_upsert(
        session,
        InstancePerformance,
        rows,
        conflict_cols=["instanceId"],
        update_cols=update_cols,
    )
    session.commit()
