-- ParticipantChatAnalytics rollup for a single (analytics_type, timestamp, [win_start, win_end)) window.
-- Parameters:
--   :win_start       timestamptz — window start (inclusive)
--   :win_end         timestamptz — window end (exclusive)
--   :analytics_type  text        — AnalyticsType ('DAILY' | 'WEEKLY' | 'MONTHLY' | 'COURSE')
--   :ts              date        — timestamp column value (for COURSE use the sentinel 1970-01-01)
-- Only participants with acceptedDisclaimerId IS NOT NULL are included (§3.9 privacy gate).

WITH params AS (
  SELECT :win_start::timestamptz AS win_start,
         :win_end::timestamptz AS win_end
),
eligible_pairs AS (
  SELECT "participantId", "chatbotId"
  FROM "ChatUsageCredits"
  WHERE "acceptedDisclaimerId" IS NOT NULL
),
messages AS (
  SELECT
    m.id,
    m.role,
    m."chatMode",
    m."reasoningEffort",
    m.content,
    m."creditsUsed",
    m."createdAt",
    m."threadId",
    ct."participantId",
    ct."chatbotId",
    cb."courseId",
    COALESCE(length(m.content::jsonb->0->>'text'), 0) AS text_len
  FROM "ChatMessage" m
  JOIN "ChatThread" ct ON ct.id = m."threadId"
  JOIN "Chatbot" cb ON cb.id = ct."chatbotId"
  JOIN eligible_pairs ep
    ON ep."participantId" = ct."participantId" AND ep."chatbotId" = ct."chatbotId"
  CROSS JOIN params
  WHERE m."createdAt" >= params.win_start AND m."createdAt" < params.win_end
),
user_msgs AS (
  SELECT * FROM messages WHERE role = 'user'
),
per_thread AS (
  SELECT "participantId", "chatbotId", "threadId", COUNT(*) AS n
  FROM user_msgs GROUP BY 1, 2, 3
),
user_rollup AS (
  SELECT
    "participantId",
    "chatbotId",
    "courseId",
    COUNT(*)                                                    AS user_messages,
    COUNT(DISTINCT "threadId")                                  AS threads,
    COUNT(DISTINCT ("createdAt" AT TIME ZONE 'UTC')::date)      AS distinct_days,
    MIN("createdAt")                                            AS first_message_at,
    MAX("createdAt")                                            AS last_message_at,
    percentile_cont(0.5)  WITHIN GROUP (ORDER BY text_len)      AS msg_len_median,
    percentile_cont(0.9)  WITHIN GROUP (ORDER BY text_len)      AS msg_len_p90,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY text_len)      AS msg_len_p99
  FROM user_msgs GROUP BY 1, 2, 3
),
thread_quantiles AS (
  SELECT
    "participantId",
    "chatbotId",
    percentile_cont(0.5) WITHIN GROUP (ORDER BY n) AS messages_per_thread_p50,
    percentile_cont(0.9) WITHIN GROUP (ORDER BY n) AS messages_per_thread_p90
  FROM per_thread GROUP BY 1, 2
),
mode_counts AS (
  SELECT "participantId", "chatbotId",
         jsonb_object_agg(COALESCE("chatMode", '__null__'), cnt) AS chat_mode_counts
  FROM (
    SELECT "participantId", "chatbotId", "chatMode", COUNT(*) AS cnt
    FROM user_msgs GROUP BY 1, 2, 3
  ) t GROUP BY "participantId", "chatbotId"
),
effort_counts AS (
  SELECT "participantId", "chatbotId",
         jsonb_object_agg(COALESCE("reasoningEffort", '__null__'), cnt) AS reasoning_effort_counts
  FROM (
    SELECT "participantId", "chatbotId", "reasoningEffort", COUNT(*) AS cnt
    FROM user_msgs GROUP BY 1, 2, 3
  ) t GROUP BY "participantId", "chatbotId"
),
assistant_rollup AS (
  SELECT
    "participantId",
    "chatbotId",
    COUNT(*)                                   AS assistant_messages,
    COALESCE(SUM("creditsUsed"), 0)            AS total_credits_used,
    SUM(
      CASE WHEN jsonb_typeof(content) = 'array'
           THEN (SELECT count(*) FROM jsonb_array_elements(content) e WHERE e->>'type' = 'tool-call')
           ELSE 0
      END
    )::int                                     AS tool_call_count
  FROM messages WHERE role = 'assistant' GROUP BY 1, 2
),
attachment_rollup AS (
  SELECT ct."participantId", ct."chatbotId", COUNT(a.id) AS attachment_count
  FROM "ChatAttachment" a
  JOIN "ChatMessage" m ON m.id = a."messageId"
  JOIN "ChatThread" ct ON ct.id = m."threadId"
  JOIN eligible_pairs ep ON ep."participantId" = ct."participantId" AND ep."chatbotId" = ct."chatbotId"
  CROSS JOIN params
  WHERE m.role = 'user'
    AND m."createdAt" >= params.win_start AND m."createdAt" < params.win_end
  GROUP BY 1, 2
),
credits_snapshot AS (
  -- current ChatUsageCredits snapshot; used as a coarse proxy for credit exhaustion in-window
  SELECT "participantId", "chatbotId", ("current" = 0) AS credits_exhausted
  FROM "ChatUsageCredits"
)
INSERT INTO "ParticipantChatAnalytics" (
  "type", "timestamp", "participantId", "chatbotId", "courseId",
  "userMessages", "assistantMessages", "threads", "distinctDays",
  "firstMessageAt", "lastMessageAt",
  "msgLenMedian", "msgLenP90", "msgLenP99",
  "messagesPerThreadP50", "messagesPerThreadP90",
  "chatModeCounts", "reasoningEffortCounts",
  "attachmentCount", "toolCallCount",
  "totalCreditsUsed", "creditsExhausted",
  "createdAt", "updatedAt"
)
SELECT
  :analytics_type::"AnalyticsType",
  :ts::date,
  ur."participantId",
  ur."chatbotId",
  ur."courseId",
  ur.user_messages,
  COALESCE(ar.assistant_messages, 0),
  ur.threads,
  ur.distinct_days,
  ur.first_message_at,
  ur.last_message_at,
  ur.msg_len_median,
  ur.msg_len_p90,
  ur.msg_len_p99,
  tq.messages_per_thread_p50,
  tq.messages_per_thread_p90,
  COALESCE(mc.chat_mode_counts, '{}'::jsonb),
  COALESCE(ec.reasoning_effort_counts, '{}'::jsonb),
  COALESCE(att.attachment_count, 0),
  COALESCE(ar.tool_call_count, 0),
  COALESCE(ar.total_credits_used, 0),
  COALESCE(cs.credits_exhausted, false),
  NOW(), NOW()
FROM user_rollup ur
LEFT JOIN thread_quantiles tq  USING ("participantId", "chatbotId")
LEFT JOIN mode_counts mc       USING ("participantId", "chatbotId")
LEFT JOIN effort_counts ec     USING ("participantId", "chatbotId")
LEFT JOIN assistant_rollup ar  USING ("participantId", "chatbotId")
LEFT JOIN attachment_rollup att USING ("participantId", "chatbotId")
LEFT JOIN credits_snapshot cs  USING ("participantId", "chatbotId")
ON CONFLICT ("type", "participantId", "chatbotId", "timestamp") DO UPDATE SET
  "courseId"             = EXCLUDED."courseId",
  "userMessages"         = EXCLUDED."userMessages",
  "assistantMessages"    = EXCLUDED."assistantMessages",
  "threads"              = EXCLUDED."threads",
  "distinctDays"         = EXCLUDED."distinctDays",
  "firstMessageAt"       = EXCLUDED."firstMessageAt",
  "lastMessageAt"        = EXCLUDED."lastMessageAt",
  "msgLenMedian"         = EXCLUDED."msgLenMedian",
  "msgLenP90"            = EXCLUDED."msgLenP90",
  "msgLenP99"            = EXCLUDED."msgLenP99",
  "messagesPerThreadP50" = EXCLUDED."messagesPerThreadP50",
  "messagesPerThreadP90" = EXCLUDED."messagesPerThreadP90",
  "chatModeCounts"       = EXCLUDED."chatModeCounts",
  "reasoningEffortCounts"= EXCLUDED."reasoningEffortCounts",
  "attachmentCount"      = EXCLUDED."attachmentCount",
  "toolCallCount"        = EXCLUDED."toolCallCount",
  "totalCreditsUsed"     = EXCLUDED."totalCreditsUsed",
  "creditsExhausted"     = EXCLUDED."creditsExhausted",
  "updatedAt"            = NOW()
WHERE "ParticipantChatAnalytics"."type" = 'COURSE';
