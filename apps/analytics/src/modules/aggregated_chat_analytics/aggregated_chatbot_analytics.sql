-- AggregatedChatbotAnalytics rollup for DAILY / MONTHLY / COURSE windows.
-- Parameters:
--   :win_start       timestamptz — window start (inclusive)
--   :win_end         timestamptz — window end (exclusive)
--   :analytics_type  text        — AnalyticsType ('DAILY' | 'MONTHLY' | 'COURSE')
--   :ts              date        — timestamp column value (COURSE uses sentinel 1970-01-01)
-- For these window types the new/returning split isn't populated (deck-only metric
-- meaningful at WEEKLY granularity) — see aggregated_chatbot_analytics_weekly.sql.

WITH params AS (
  SELECT :win_start::timestamptz AS win_start,
         :win_end::timestamptz AS win_end
),
messages AS (
  SELECT
    m.id, m.role, m."chatMode", m."modelId", m."reasoningEffort",
    m."creditsUsed", m."createdAt", m."threadId",
    ct."participantId", ct."chatbotId", cb."courseId"
  FROM "ChatMessage" m
  JOIN "ChatThread" ct ON ct.id = m."threadId"
  JOIN "Chatbot" cb   ON cb.id = ct."chatbotId"
  CROSS JOIN params
  WHERE m."createdAt" >= params.win_start AND m."createdAt" < params.win_end
),
user_msgs AS (SELECT * FROM messages WHERE role = 'user'),
rollup AS (
  SELECT
    "chatbotId",
    "courseId",
    COUNT(DISTINCT "participantId") AS active_participants,
    COUNT(DISTINCT "threadId")      AS threads,
    COUNT(*)                        AS user_messages
  FROM user_msgs GROUP BY 1, 2
),
assistant_rollup AS (
  SELECT
    "chatbotId",
    COUNT(*)                        AS assistant_messages,
    COALESCE(SUM("creditsUsed"), 0) AS total_credits_used
  FROM messages WHERE role = 'assistant' GROUP BY 1
),
hour_of_day_raw AS (
  SELECT
    "chatbotId",
    EXTRACT(ISODOW FROM "createdAt" AT TIME ZONE 'UTC')::int AS iso_dow,
    EXTRACT(HOUR   FROM "createdAt" AT TIME ZONE 'UTC')::int AS hr,
    COUNT(*) AS cnt
  FROM user_msgs GROUP BY 1, 2, 3
),
hour_of_day AS (
  SELECT
    "chatbotId",
    jsonb_object_agg(iso_dow::text, hours) AS hour_of_day_distribution
  FROM (
    SELECT
      "chatbotId",
      iso_dow,
      jsonb_agg(jsonb_build_array(hr, cnt) ORDER BY hr) AS hours
    FROM hour_of_day_raw GROUP BY 1, 2
  ) t GROUP BY 1
),
model_counts AS (
  SELECT "chatbotId",
         jsonb_object_agg(COALESCE("modelId", '__null__'), cnt) AS model_distribution
  FROM (
    SELECT "chatbotId", "modelId", COUNT(*) AS cnt
    FROM messages WHERE role = 'assistant' GROUP BY 1, 2
  ) t GROUP BY 1
),
mode_counts AS (
  SELECT "chatbotId",
         jsonb_object_agg(COALESCE("chatMode", '__null__'), cnt) AS mode_distribution
  FROM (
    SELECT "chatbotId", "chatMode", COUNT(*) AS cnt
    FROM user_msgs GROUP BY 1, 2
  ) t GROUP BY 1
),
effort_counts AS (
  SELECT "chatbotId",
         jsonb_object_agg(COALESCE("reasoningEffort", '__null__'), cnt) AS reasoning_effort_distribution
  FROM (
    SELECT "chatbotId", "reasoningEffort", COUNT(*) AS cnt
    FROM user_msgs GROUP BY 1, 2
  ) t GROUP BY 1
),
disclaimer_counts AS (
  -- Snapshot counts (NOT window-scoped). Overwritten on every run — reflects the
  -- current state of consent, not the state at the time the window was computed.
  SELECT
    "chatbotId",
    COUNT(*) FILTER (WHERE "acceptedDisclaimerId" IS NOT NULL) AS disclaimer_accepted,
    COUNT(*) FILTER (WHERE "disclaimerDeclined" = true)        AS disclaimer_declined
  FROM "ChatUsageCredits" GROUP BY 1
),
credit_exhaustion AS (
  -- Snapshot of the live "current" balance, same caveat as disclaimer_counts.
  SELECT
    "chatbotId",
    SUM(CASE WHEN "current" = 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) AS credit_exhaustion_rate
  FROM "ChatUsageCredits" GROUP BY 1
)
INSERT INTO "AggregatedChatbotAnalytics" (
  "type", "timestamp", "chatbotId", "courseId",
  "activeParticipants", "newParticipants", "returningParticipants",
  "threads", "userMessages", "assistantMessages",
  "totalCreditsUsed", "creditExhaustionRate",
  "disclaimerAcceptedCount", "disclaimerDeclinedCount",
  "hourOfDayDistribution", "modelDistribution",
  "modeDistribution", "reasoningEffortDistribution",
  "createdAt", "updatedAt"
)
SELECT
  :analytics_type::"AnalyticsType",
  :ts::date,
  r."chatbotId",
  r."courseId",
  r.active_participants,
  0,                                            -- newParticipants: WEEKLY only
  0,                                            -- returningParticipants: WEEKLY only
  r.threads,
  r.user_messages,
  COALESCE(ar.assistant_messages, 0),
  COALESCE(ar.total_credits_used, 0),
  ce.credit_exhaustion_rate,
  COALESCE(dc.disclaimer_accepted, 0),
  COALESCE(dc.disclaimer_declined, 0),
  COALESCE(hod.hour_of_day_distribution, '{}'::jsonb),
  COALESCE(mdl.model_distribution, '{}'::jsonb),
  COALESCE(mc.mode_distribution, '{}'::jsonb),
  COALESCE(ec.reasoning_effort_distribution, '{}'::jsonb),
  NOW(), NOW()
FROM rollup r
LEFT JOIN assistant_rollup ar  USING ("chatbotId")
LEFT JOIN hour_of_day hod      USING ("chatbotId")
LEFT JOIN model_counts mdl     USING ("chatbotId")
LEFT JOIN mode_counts mc       USING ("chatbotId")
LEFT JOIN effort_counts ec     USING ("chatbotId")
LEFT JOIN disclaimer_counts dc USING ("chatbotId")
LEFT JOIN credit_exhaustion ce USING ("chatbotId")
ON CONFLICT ("type", "chatbotId", "timestamp") DO UPDATE SET
  "courseId"                    = EXCLUDED."courseId",
  "activeParticipants"          = EXCLUDED."activeParticipants",
  "newParticipants"             = EXCLUDED."newParticipants",
  "returningParticipants"       = EXCLUDED."returningParticipants",
  "threads"                     = EXCLUDED."threads",
  "userMessages"                = EXCLUDED."userMessages",
  "assistantMessages"           = EXCLUDED."assistantMessages",
  "totalCreditsUsed"            = EXCLUDED."totalCreditsUsed",
  "creditExhaustionRate"        = EXCLUDED."creditExhaustionRate",
  "disclaimerAcceptedCount"     = EXCLUDED."disclaimerAcceptedCount",
  "disclaimerDeclinedCount"     = EXCLUDED."disclaimerDeclinedCount",
  "hourOfDayDistribution"       = EXCLUDED."hourOfDayDistribution",
  "modelDistribution"           = EXCLUDED."modelDistribution",
  "modeDistribution"            = EXCLUDED."modeDistribution",
  "reasoningEffortDistribution" = EXCLUDED."reasoningEffortDistribution",
  "updatedAt"                   = NOW()
WHERE "AggregatedChatbotAnalytics"."type" = 'COURSE';
