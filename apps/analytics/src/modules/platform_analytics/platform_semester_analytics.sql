-- One row per UZH semester. Semester boundaries are the same ones used in Batch 6:
--   FS{YY}: YYYY-02-15 .. YYYY-08-31
--   HS{YY}: YYYY-09-01 .. (YYYY+1)-02-14
-- The semesters CTE is generated dynamically from the earliest data row, so the query
-- keeps working year after year without code changes.

WITH eligible_participations AS MATERIALIZED (
  SELECT
    p.id,
    p."participantId",
    p."courseId",
    p."learningAnalyticsIncludedFrom"
  FROM "Participation" p
  JOIN "Course" c ON c.id = p."courseId"
  WHERE c."isLearningAnalyticsEnabled" = true
    /*COURSE_FILTER*/
    AND p."learningAnalyticsStatus" = 'INCLUDED'
    AND p."learningAnalyticsDisclosureVersion" = '2026-07-30-v1'
    AND p."learningAnalyticsIncludedFrom" IS NOT NULL
),
eligible_quiz_details AS MATERIALIZED (
  SELECT qrd.*, ep."courseId"
  FROM "QuestionResponseDetail" qrd
  JOIN "ElementInstance" ei
    ON ei.id = qrd."elementInstanceId"
   AND ei."elementType" <> 'FREE_TEXT'
  JOIN eligible_participations ep ON ep.id = qrd."participationId"
  WHERE qrd."createdAt" >= ep."learningAnalyticsIncludedFrom"
),
eligible_live_responses AS MATERIALIZED (
  SELECT lqr.*, ep."courseId"
  FROM "LiveQuizResponse" lqr
  JOIN "ElementInstance" ei ON ei.id = lqr."instanceId"
  JOIN "ElementBlock" eb ON eb.id = ei."elementBlockId"
  JOIN "LiveQuiz" lq ON lq.id = eb."liveQuizId"
  JOIN eligible_participations ep
    ON ep."participantId" = lqr."participantId"
   AND ep."courseId" = lq."courseId"
  WHERE lqr."submittedAt" >= ep."learningAnalyticsIncludedFrom"
),
eligible_chat_messages AS MATERIALIZED (
  SELECT m.*, ct."participantId", cb."courseId"
  FROM "ChatMessage" m
  JOIN "ChatThread" ct ON ct.id = m."threadId"
  JOIN "Chatbot" cb ON cb.id = ct."chatbotId"
  JOIN eligible_participations ep
    ON ep."participantId" = ct."participantId"
   AND ep."courseId" = cb."courseId"
  WHERE m."createdAt" >= ep."learningAnalyticsIncludedFrom"
),
bounds AS (
  SELECT
    LEAST(
      COALESCE((SELECT MIN("createdAt") FROM eligible_quiz_details), NOW()),
      COALESCE((SELECT MIN("createdAt") FROM eligible_live_responses), NOW()),
      COALESCE((SELECT MIN("createdAt") FROM eligible_chat_messages), NOW())
    ) AS first_seen,
    NOW() AS now_ts
),
years AS (
  SELECT generate_series(
    EXTRACT(YEAR FROM (SELECT first_seen FROM bounds))::int,
    EXTRACT(YEAR FROM (SELECT now_ts     FROM bounds))::int + 1
  ) AS yr
),
semesters AS (
  SELECT
    ('FS' || LPAD((yr % 100)::text, 2, '0')) AS semester_label,
    make_timestamp(yr,     2, 15, 0, 0, 0)         AS semester_start,
    make_timestamp(yr,     8, 31, 23, 59, 59)      AS semester_end
  FROM years
  UNION ALL
  SELECT
    ('HS' || LPAD((yr % 100)::text, 2, '0')),
    make_timestamp(yr,     9,  1, 0, 0, 0),
    make_timestamp(yr + 1, 2, 14, 23, 59, 59)
  FROM years
),
relevant_semesters AS (
  SELECT * FROM semesters s, bounds b
  WHERE s.semester_end   >= b.first_seen
    AND s.semester_start <= b.now_ts
)
INSERT INTO "PlatformSemesterAnalytics" (
  "semesterLabel", "semesterStart", "semesterEnd",
  "quizResponseRows", "quizTrials", "quizDistinctParticipants",
  "liveQuizResponses", "liveQuizDistinctParticipants",
  "chatMessages", "chatDistinctParticipants",
  "activeCourses", "coursesWithChatbot", "coursesWithLiveQuiz", "coursesWithQuizActivity",
  "createdAt", "updatedAt"
)
SELECT
  rs.semester_label,
  rs.semester_start,
  rs.semester_end,
  COALESCE(q.response_rows, 0),
  COALESCE(q.total_trials, 0),
  COALESCE(q.distinct_participants, 0),
  COALESCE(lq.responses, 0),
  COALESCE(lq.distinct_participants, 0),
  COALESCE(ch.messages, 0),
  COALESCE(ch.distinct_participants, 0),
  COALESCE(c.active_courses, 0),
  COALESCE(c.courses_with_chatbot, 0),
  COALESCE(c.courses_with_livequiz, 0),
  COALESCE(c.courses_with_quiz_activity, 0),
  NOW(), NOW()
FROM relevant_semesters rs
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT (
      qr."participantId",
      qr."elementInstanceId",
      qr."practiceQuizId",
      qr."microLearningId"
    ))                                                                  AS response_rows,
    COUNT(*)                                                            AS total_trials,
    COUNT(DISTINCT qr."participantId")                                  AS distinct_participants
  FROM eligible_quiz_details qr
  WHERE qr."createdAt" >= rs.semester_start AND qr."createdAt" <= rs.semester_end
) q ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                            AS responses,
    COUNT(DISTINCT lqr."participantId")                                 AS distinct_participants
  FROM eligible_live_responses lqr
  WHERE lqr."createdAt" >= rs.semester_start AND lqr."createdAt" <= rs.semester_end
) lq ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                            AS messages,
    COUNT(DISTINCT m."participantId")                                   AS distinct_participants
  FROM eligible_chat_messages m
  WHERE m."createdAt" >= rs.semester_start AND m."createdAt" <= rs.semester_end
    AND m.role = 'user'
) ch ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT c.id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM eligible_participations p
        WHERE p."courseId" = c.id
      )
    ) AS active_courses,
    COUNT(DISTINCT c.id) FILTER (
      WHERE EXISTS (SELECT 1 FROM "Chatbot" cb WHERE cb."courseId" = c.id)
    ) AS courses_with_chatbot,
    COUNT(DISTINCT c.id) FILTER (
      WHERE EXISTS (SELECT 1 FROM "LiveQuiz" lq2 WHERE lq2."courseId" = c.id)
    ) AS courses_with_livequiz,
    COUNT(DISTINCT c.id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM eligible_quiz_details qr2
        WHERE qr2."courseId" = c.id
          AND qr2."createdAt" >= rs.semester_start AND qr2."createdAt" <= rs.semester_end
      )
    ) AS courses_with_quiz_activity
  FROM "Course" c
  WHERE c."startDate" <= rs.semester_end
    AND c."endDate"   >= rs.semester_start
    AND c."isLearningAnalyticsEnabled" = true
    /*COURSE_FILTER*/
) c ON true
ON CONFLICT ("semesterLabel") DO UPDATE SET
  "semesterStart"                = EXCLUDED."semesterStart",
  "semesterEnd"                  = EXCLUDED."semesterEnd",
  "quizResponseRows"             = EXCLUDED."quizResponseRows",
  "quizTrials"                   = EXCLUDED."quizTrials",
  "quizDistinctParticipants"     = EXCLUDED."quizDistinctParticipants",
  "liveQuizResponses"            = EXCLUDED."liveQuizResponses",
  "liveQuizDistinctParticipants" = EXCLUDED."liveQuizDistinctParticipants",
  "chatMessages"                 = EXCLUDED."chatMessages",
  "chatDistinctParticipants"     = EXCLUDED."chatDistinctParticipants",
  "activeCourses"                = EXCLUDED."activeCourses",
  "coursesWithChatbot"           = EXCLUDED."coursesWithChatbot",
  "coursesWithLiveQuiz"          = EXCLUDED."coursesWithLiveQuiz",
  "coursesWithQuizActivity"      = EXCLUDED."coursesWithQuizActivity",
  "updatedAt"                    = NOW();
