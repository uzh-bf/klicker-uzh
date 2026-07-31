-- Updates ParticipantCourseAnalytics.hasChatActivity based on whether any
-- ParticipantChatAnalytics (type=COURSE) row exists for the (participantId, courseId).
-- Runs after participant_chat_outcome.sql.

UPDATE "ParticipantCourseAnalytics" pca SET
  "hasChatActivity" = EXISTS (
    SELECT 1 FROM "ParticipantChatAnalytics" pcha
    WHERE pcha."type" = 'COURSE'
      AND pcha."participantId" = pca."participantId"
      AND pcha."courseId"      = pca."courseId"
      AND pcha."userMessages" > 0
  )
WHERE true
  /*COURSE_FILTER*/;
