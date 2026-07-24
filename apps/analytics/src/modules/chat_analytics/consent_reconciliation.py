from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.dryrun import buffer_registry
from src.modules.utils import render_uuid_in_clause

_CURRENT_SCOPE_PLACEHOLDER = "/*CURRENT_COURSE_FILTER*/"
_STALE_SCOPE_PLACEHOLDER = "/*STALE_COURSE_FILTER*/"
_PURGE_SCOPE_PLACEHOLDER = "/*PURGE_COURSE_FILTER*/"

_HISTORY_REBUILD_SQL = """
WITH changed_pairs AS (
  SELECT
    cuc."participantId",
    cuc."chatbotId",
    cb."courseId"
  FROM "ChatUsageCredits" cuc
  JOIN "Chatbot" cb ON cb.id = cuc."chatbotId"
  JOIN "Course" c ON c.id = cb."courseId"
  WHERE (
    c."chatAnalyticsValidAt" IS NULL
    OR cuc."disclaimerAcceptedAt" > c."chatAnalyticsValidAt"
    OR (
      cuc."disclaimerDeclined" = true
      AND cuc."updatedAt" > c."chatAnalyticsValidAt"
    )
    OR (
      cuc."acceptedDisclaimerId" IS DISTINCT FROM cb."disclaimerId"
      AND cb."updatedAt" > c."chatAnalyticsValidAt"
    )
  )
  /*CURRENT_COURSE_FILTER*/

  UNION

  SELECT
    pca."participantId",
    pca."chatbotId",
    pca."courseId"
  FROM "ParticipantChatAnalytics" pca
  JOIN "Chatbot" cb ON cb.id = pca."chatbotId"
  LEFT JOIN "ChatUsageCredits" cuc
    ON cuc."participantId" = pca."participantId"
   AND cuc."chatbotId" = pca."chatbotId"
  WHERE (
    cuc."participantId" IS NULL
    OR cuc."acceptedDisclaimerId" IS DISTINCT FROM cb."disclaimerId"
    OR cuc."disclaimerDeclined" = true
  )
  /*STALE_COURSE_FILTER*/
),
affected_dates AS (
  SELECT
    cp."courseId",
    m."createdAt"::date AS "affectedDate"
  FROM changed_pairs cp
  JOIN "ChatThread" ct
    ON ct."participantId" = cp."participantId"
   AND ct."chatbotId" = cp."chatbotId"
  JOIN "ChatMessage" m ON m."threadId" = ct.id
  WHERE m."createdAt" < CAST(:incremental_since AS timestamptz)

  UNION ALL

  SELECT
    cp."courseId",
    aca."timestamp" AS "affectedDate"
  FROM changed_pairs cp
  JOIN "AggregatedChatbotAnalytics" aca
    ON aca."chatbotId" = cp."chatbotId"
   AND aca."courseId" = cp."courseId"
  WHERE aca."timestamp" < CAST(:incremental_since AS date)
),
affected_history AS (
  SELECT
    "courseId",
    MIN("affectedDate") AS "windowSince"
  FROM affected_dates
  GROUP BY "courseId"
)
SELECT "courseId", "windowSince"
FROM affected_history
ORDER BY "courseId"
"""

_PURGE_INELIGIBLE_SQL = """
WITH ineligible_rows AS MATERIALIZED (
  SELECT pca."participantId", pca."chatbotId", pca."timestamp", pca."type", pca."courseId"
  FROM "ParticipantChatAnalytics" pca
  JOIN "Chatbot" cb ON cb.id = pca."chatbotId"
  LEFT JOIN "ChatUsageCredits" cuc
    ON cuc."participantId" = pca."participantId"
   AND cuc."chatbotId" = pca."chatbotId"
  WHERE (
    cuc."participantId" IS NULL
    OR cuc."acceptedDisclaimerId" IS DISTINCT FROM cb."disclaimerId"
    OR cuc."disclaimerDeclined" = true
  )
  /*PURGE_COURSE_FILTER*/
),
marked_courses AS (
  UPDATE "Course" c
  SET "chatAnalyticsValidAt" = NULL
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
    current_scope = "" if course_ids is None else render_uuid_in_clause('cb."courseId"', course_ids)
    stale_scope = "" if course_ids is None else render_uuid_in_clause('pca."courseId"', course_ids)
    return _HISTORY_REBUILD_SQL.replace(
        _CURRENT_SCOPE_PLACEHOLDER,
        current_scope,
    ).replace(_STALE_SCOPE_PLACEHOLDER, stale_scope)


def plan_chat_analytics_runs(
    session: Session,
    course_ids: list[str] | None,
    window_since: str | None,
) -> list[ChatAnalyticsRun]:
    """Split incremental chat work into privacy rebuild and recent scopes."""
    if course_ids == []:
        return []
    if window_since is None:
        return [ChatAnalyticsRun(course_ids=course_ids, window_since=None)]
    if buffer_registry.is_active():
        return [ChatAnalyticsRun(course_ids=course_ids, window_since=window_since)]
    if course_ids is None:
        return [ChatAnalyticsRun(course_ids=None, window_since=None)]

    rows = session.execute(
        text(_history_rebuild_sql(course_ids)),
        {"incremental_since": window_since},
    ).mappings()
    rebuild_rows = list(rows)
    if not rebuild_rows:
        return [ChatAnalyticsRun(course_ids=course_ids, window_since=window_since)]

    rebuild_ids = [str(row["courseId"]) for row in rebuild_rows]
    earliest = min(str(row["windowSince"]) for row in rebuild_rows)
    rebuild_set = set(rebuild_ids)
    recent_ids = [course_id for course_id in course_ids if course_id not in rebuild_set]

    runs = [
        ChatAnalyticsRun(
            course_ids=rebuild_ids,
            window_since=earliest,
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
    """Remove all retained participant rows that current consent no longer permits."""
    if buffer_registry.is_active():
        return 0
    scope = "" if course_ids is None else render_uuid_in_clause('pca."courseId"', course_ids)
    result = session.execute(text(_PURGE_INELIGIBLE_SQL.replace(_PURGE_SCOPE_PLACEHOLDER, scope)))
    session.commit()
    return result.rowcount or 0
