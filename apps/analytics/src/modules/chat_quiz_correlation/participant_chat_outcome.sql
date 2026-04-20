-- ParticipantChatOutcome: per-participant-per-course join of chat volume + quiz performance.
-- Source: ParticipantChatAnalytics (type=COURSE) ⨝ ParticipantPerformance on (participantId, courseId).
-- Upstream pipeline dependencies guarantee that participant chat and performance
-- computation completed. Either source may legitimately be empty.
--
-- chatDoseBucket (per §3.5 script 11):
--   NONE : chatMessagesInCourse = 0 (these come from the LEFT JOIN where pca is NULL)
--   LOW  : > 0 and <= p33
--   MED  : > p33 and <= p66
--   HIGH : > p66
-- Percentile cuts are computed per-course from the non-zero chat-message counts.

WITH chat_course AS (
  SELECT "courseId", "participantId", "userMessages" AS chat_messages
  FROM "ParticipantChatAnalytics"
  WHERE "type" = 'COURSE' AND "userMessages" > 0
    /*CHAT_COURSE_FILTER*/
),
cuts AS (
  SELECT
    "courseId",
    percentile_cont(0.33) WITHIN GROUP (ORDER BY chat_messages) AS cut_low,
    percentile_cont(0.66) WITHIN GROUP (ORDER BY chat_messages) AS cut_med
  FROM chat_course GROUP BY "courseId"
),
course_participants AS (
  -- union of (participant, course) pairs eligible for an outcome row:
  --   * enrolled participants (Participation), OR
  --   * participants who have chat or quiz activity in the course
  SELECT DISTINCT "participantId", "courseId"
  FROM (
    SELECT "participantId", "courseId" FROM "Participation"
    WHERE true
      /*COURSE_PARTICIPATION_FILTER*/
    UNION
    SELECT "participantId", "courseId" FROM chat_course
    UNION
    SELECT "participantId", "courseId" FROM "ParticipantPerformance"
    WHERE true
      /*COURSE_PERFORMANCE_FILTER*/
  ) u
)
INSERT INTO "ParticipantChatOutcome" (
  "participantId", "courseId",
  "chatMessagesInCourse", "chatDoseBucket",
  "firstErrorRate", "lastErrorRate", "errorRateDelta",
  "hasBothModalities",
  "createdAt", "updatedAt"
)
SELECT
  cp."participantId",
  cp."courseId",
  COALESCE(cc.chat_messages, 0) AS chat_messages_in_course,
  CASE
    WHEN cc.chat_messages IS NULL OR cc.chat_messages = 0 THEN 'NONE'::"ChatDoseBucket"
    WHEN cc.chat_messages <= c.cut_low                    THEN 'LOW'::"ChatDoseBucket"
    WHEN cc.chat_messages <= c.cut_med                    THEN 'MED'::"ChatDoseBucket"
    ELSE                                                        'HIGH'::"ChatDoseBucket"
  END AS chat_dose_bucket,
  pp."firstErrorRate",
  pp."lastErrorRate",
  (pp."lastErrorRate" - pp."firstErrorRate") AS error_rate_delta,
  (cc.chat_messages IS NOT NULL AND cc.chat_messages > 0
   AND pp."participantId" IS NOT NULL)       AS has_both_modalities,
  NOW(), NOW()
FROM course_participants cp
LEFT JOIN chat_course cc
       ON cc."participantId" = cp."participantId" AND cc."courseId" = cp."courseId"
LEFT JOIN cuts c
       ON c."courseId" = cp."courseId"
LEFT JOIN "ParticipantPerformance" pp
       ON pp."participantId" = cp."participantId" AND pp."courseId" = cp."courseId"
ON CONFLICT ("participantId", "courseId") DO UPDATE SET
  "chatMessagesInCourse" = EXCLUDED."chatMessagesInCourse",
  "chatDoseBucket"       = EXCLUDED."chatDoseBucket",
  "firstErrorRate"       = EXCLUDED."firstErrorRate",
  "lastErrorRate"        = EXCLUDED."lastErrorRate",
  "errorRateDelta"       = EXCLUDED."errorRateDelta",
  "hasBothModalities"    = EXCLUDED."hasBothModalities",
  "updatedAt"            = NOW();
