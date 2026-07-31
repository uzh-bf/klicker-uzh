-- Updates AggregatedCourseAnalytics modality-footprint columns for every course.
-- Requires that AggregatedCourseAnalytics rows already exist for the course (they are
-- created by script 2 — 2_initial_aggregated_course_analytics). Courses without a row are
-- skipped silently; this script never creates rows.

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
chat_courses AS (
  SELECT DISTINCT ct."participantId", cb."courseId" AS "courseId"
  FROM "ChatMessage" m
  JOIN "ChatThread" ct ON ct.id = m."threadId"
  JOIN "Chatbot" cb ON cb.id = ct."chatbotId"
  JOIN eligible_participations ep
    ON ep."participantId" = ct."participantId"
   AND ep."courseId" = cb."courseId"
  WHERE m.role = 'user'
    AND m."createdAt" >= ep."learningAnalyticsIncludedFrom"
),
quiz_courses AS (
  SELECT DISTINCT qrd."participantId", ep."courseId"
  FROM "QuestionResponseDetail" qrd
  JOIN "ElementInstance" ei
    ON ei.id = qrd."elementInstanceId"
   AND ei."elementType" <> 'FREE_TEXT'
  JOIN eligible_participations ep ON ep.id = qrd."participationId"
  WHERE qrd."createdAt" >= ep."learningAnalyticsIncludedFrom"
),
footprint AS (
  SELECT
    c.id AS "courseId",
    (SELECT COUNT(*) FROM "Chatbot"       cb WHERE cb."courseId" = c.id)            AS chatbot_count,
    (SELECT COUNT(*) FROM "PracticeQuiz"  pq WHERE pq."courseId" = c.id)            AS practice_quiz_count,
    (SELECT COUNT(*) FROM "MicroLearning" ml WHERE ml."courseId" = c.id)            AS microlearning_count,
    (SELECT COUNT(*) FROM "LiveQuiz"      lq WHERE lq."courseId" = c.id)            AS live_quiz_count,
    (SELECT COUNT(*) FROM chat_courses cc WHERE cc."courseId" = c.id)               AS chat_participant_count,
    (SELECT COUNT(*) FROM quiz_courses qc WHERE qc."courseId" = c.id)               AS quiz_participant_count,
    (SELECT COUNT(*)
     FROM chat_courses cc JOIN quiz_courses qc USING ("participantId", "courseId")
     WHERE cc."courseId" = c.id)                                                    AS both_chat_and_quiz_count
  FROM "Course" c
  WHERE c."isLearningAnalyticsEnabled" = true
    /*COURSE_FILTER*/
)
UPDATE "AggregatedCourseAnalytics" aca SET
  "chatbotCount"         = f.chatbot_count,
  "practiceQuizCount"    = f.practice_quiz_count,
  "microLearningCount"   = f.microlearning_count,
  "liveQuizCount"        = f.live_quiz_count,
  "chatParticipantCount" = f.chat_participant_count,
  "quizParticipantCount" = f.quiz_participant_count,
  "bothChatAndQuizCount" = f.both_chat_and_quiz_count,
  "updatedAt"            = NOW()
FROM footprint f
WHERE aca."courseId" = f."courseId";
