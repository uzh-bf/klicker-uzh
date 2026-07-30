from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.dryrun import buffer_registry
from src.modules.learning_analytics_eligibility import (
    LEARNING_ANALYTICS_DISCLOSURE_VERSION,
)
from src.modules.utils import render_uuid_in_clause

_DIRTY_SCOPE_PLACEHOLDER = "/*DIRTY_COURSE_FILTER*/"
_PURGE_SCOPE_PLACEHOLDER = "/*PURGE_COURSE_FILTER*/"
_ANALYTICS_HISTORY_START = "2022-10-23"

_HISTORY_REBUILD_SQL = """
SELECT
  c.id AS "courseId",
  CAST(:history_start AS date) AS "windowSince"
FROM "Course" c
WHERE c."isLearningAnalyticsEnabled" = true
  AND c."chatAnalyticsValidAt" IS NULL
  /*DIRTY_COURSE_FILTER*/
ORDER BY c.id
"""

_PURGE_INELIGIBLE_SQL = """
WITH ineligible_rows AS MATERIALIZED (
  SELECT
    pca."participantId",
    pca."chatbotId",
    pca."timestamp",
    pca."type",
    pca."courseId"
  FROM "ParticipantChatAnalytics" pca
  JOIN "Course" c ON c.id = pca."courseId"
  LEFT JOIN "Participation" p
    ON p."participantId" = pca."participantId"
   AND p."courseId" = pca."courseId"
  WHERE (
    c."isLearningAnalyticsEnabled" = false
    OR p.id IS NULL
    OR p."learningAnalyticsStatus" IS DISTINCT FROM 'INCLUDED'
    OR p."learningAnalyticsDisclosureVersion" IS DISTINCT FROM :disclosure_version
    OR p."learningAnalyticsIncludedFrom" IS NULL
  )
  /*PURGE_COURSE_FILTER*/
),
marked_courses AS (
  UPDATE "Course" c
  SET
    "areAnalyticsValid" = false,
    "chatAnalyticsValidAt" = NULL
  WHERE c.id IN (SELECT DISTINCT "courseId" FROM ineligible_rows)
  RETURNING c.id
)
DELETE FROM "ParticipantChatAnalytics" pca
USING ineligible_rows stale
JOIN marked_courses marked ON marked.id = stale."courseId"
WHERE pca."participantId" = stale."participantId"
  AND pca."chatbotId" = stale."chatbotId"
  AND pca."timestamp" = stale."timestamp"
  AND pca."type" = stale."type"
"""


@dataclass(frozen=True, slots=True)
class ChatAnalyticsRun:
    course_ids: list[str] | None
    window_since: str | None


def _history_rebuild_sql(course_ids: list[str] | None) -> str:
    scope = "" if course_ids is None else render_uuid_in_clause("c.id", course_ids)
    return _HISTORY_REBUILD_SQL.replace(_DIRTY_SCOPE_PLACEHOLDER, scope)


def plan_chat_analytics_runs(
    session: Session,
    course_ids: list[str] | None,
    window_since: str | None,
) -> list[ChatAnalyticsRun]:
    """Rebuild dirty LA courses from history and keep clean courses incremental."""
    if course_ids == []:
        return []
    if window_since is None:
        return [ChatAnalyticsRun(course_ids=course_ids, window_since=None)]
    if buffer_registry.is_active():
        return [ChatAnalyticsRun(course_ids=course_ids, window_since=window_since)]
    if course_ids is None:
        return [
            ChatAnalyticsRun(
                course_ids=None,
                window_since=_ANALYTICS_HISTORY_START,
            )
        ]

    rows = session.execute(
        text(_history_rebuild_sql(course_ids)),
        {"history_start": _ANALYTICS_HISTORY_START},
    ).mappings()
    rebuild_rows = list(rows)
    if not rebuild_rows:
        return [ChatAnalyticsRun(course_ids=course_ids, window_since=window_since)]

    rebuild_ids = [str(row["courseId"]) for row in rebuild_rows]
    rebuild_set = set(rebuild_ids)
    recent_ids = [course_id for course_id in course_ids if course_id not in rebuild_set]
    runs = [
        ChatAnalyticsRun(
            course_ids=rebuild_ids,
            window_since=_ANALYTICS_HISTORY_START,
        )
    ]
    if recent_ids:
        runs.append(
            ChatAnalyticsRun(
                course_ids=recent_ids,
                window_since=window_since,
            )
        )
    return runs


def purge_ineligible_participant_chat_analytics(
    session: Session,
    course_ids: list[str] | None,
) -> int:
    """Remove retained participant rows that current LA eligibility forbids."""
    if buffer_registry.is_active():
        return 0
    scope = "" if course_ids is None else render_uuid_in_clause('pca."courseId"', course_ids)
    result = session.execute(
        text(_PURGE_INELIGIBLE_SQL.replace(_PURGE_SCOPE_PLACEHOLDER, scope)),
        {"disclosure_version": LEARNING_ANALYTICS_DISCLOSURE_VERSION},
    )
    session.commit()
    return result.rowcount or 0
