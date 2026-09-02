-- Add course deletion request fields and hide pending course activities

DROP VIEW IF EXISTS "UserActivities";

ALTER TABLE "Course"
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "deletionRequestedById" UUID,
  ADD COLUMN "deleteDraftActivitiesOnDeletion" BOOLEAN NOT NULL DEFAULT false;

CREATE VIEW "UserActivities" AS
SELECT
  -- Core activity fields
  lq.id,
  'LIVE_QUIZ' as type,
  1 as "typeOrder",
  lq.name,
  lq."displayName",
  lq.description,
  lq.status,
  lq."reviewStatus",
  lq."isDeleted",

  -- Activity features
  lq."areInstancesOutdated",
  lq."isGamificationEnabled",
  lq."isAssessmentEnabled",
  lq."pointsMultiplier",
  lq."pinCode" as "pinCode",

  -- Template information
  at.id as "templateId",
  lq."templateName",

  -- Timestamps
  lq."createdAt",
  lq."updatedAt",

  -- Type-specific scheduling fields
  NULL as "availableFrom",
  CAST(NULL AS TIMESTAMP(3)) as "scheduledStartAt",
  CAST(NULL AS TIMESTAMP(3)) as "scheduledEndAt",

  -- Course information
  CASE WHEN c."deletionRequestedAt" IS NULL THEN c.id ELSE NULL END as "courseId",
  CASE WHEN c."deletionRequestedAt" IS NULL THEN c.name ELSE NULL END as "courseName",
  CASE WHEN c."deletionRequestedAt" IS NULL THEN c.language ELSE NULL END as "courseLanguage",
  CASE WHEN c."deletionRequestedAt" IS NULL THEN c."startDate" ELSE NULL END as "courseStartDate",

  -- Group activity specific
  CAST(NULL AS TIMESTAMP(3)) as "groupDeadlineDate",
  CAST(NULL AS INTEGER) as "numOfParticipantGroups",

  -- Content metrics (count blocks and their elements)
  COALESCE(block_counts.num_stacks, 0) as "numOfStacks",
  COALESCE(block_counts.num_elements, 0) as "numOfElements",

  -- Permission fields
  dp."userId",
  dp."permissionLevel",
  dp.derived,

  -- Permission details for direct permissions
  p_direct.user_group_id as "directPermissionUserGroupId",

  -- Owner information
  lq."ownerId",

  -- Permission counts for numSharedUsers and isActivityReviewer calculation
  COALESCE(activity_perm_counts.num_permissions, 0) as "numActivityPermissions",
  COALESCE(course_perm_counts.is_user_course_admin, false) as "isUserCourseAdmin"

FROM "LiveQuiz" lq
JOIN "DerivedPermission" dp ON dp."liveQuizId" = lq.id
LEFT JOIN (
  SELECT p.id, p."userGroupId" as user_group_id
  FROM "Permission" p
) p_direct ON p_direct.id = dp."directPermissionId"
LEFT JOIN "ActivityTemplate" at ON at."liveQuizId" = lq.id
LEFT JOIN "Course" c ON c.id = lq."courseId"
LEFT JOIN (
  SELECT
    eb."liveQuizId",
    COUNT(eb.id) as num_stacks,
    COALESCE(SUM(ei_counts.element_count), 0) as num_elements
  FROM "ElementBlock" eb
  LEFT JOIN (
    SELECT
      ei."elementBlockId",
      COUNT(ei.id) as element_count
    FROM "ElementInstance" ei
    GROUP BY ei."elementBlockId"
  ) ei_counts ON ei_counts."elementBlockId" = eb.id
  GROUP BY eb."liveQuizId"
) block_counts ON block_counts."liveQuizId" = lq.id
LEFT JOIN (
  SELECT
    p."liveQuizId",
    COUNT(p.id) as num_permissions
  FROM "Permission" p
  WHERE p."liveQuizId" IS NOT NULL
  GROUP BY p."liveQuizId"
) activity_perm_counts ON activity_perm_counts."liveQuizId" = lq.id
LEFT JOIN (
  SELECT
    p."courseId",
    p."userId",
    true as is_user_course_admin
  FROM "DerivedPermission" p
  WHERE p."courseId" IS NOT NULL
    AND p."permissionLevel" IN ('ADMIN', 'OWNER')
  GROUP BY p."courseId", p."userId"
) course_perm_counts ON course_perm_counts."courseId" = lq."courseId" AND course_perm_counts."userId" = dp."userId"

WHERE
  c."deletionRequestedAt" IS NULL
  OR lq.status <> 'DRAFT'
  OR c."deleteDraftActivitiesOnDeletion" IS FALSE
UNION ALL

SELECT
  -- Core activity fields
  pq.id,
  'PRACTICE_QUIZ' as type,
  2 as "typeOrder",
  pq.name,
  pq."displayName",
  pq.description,
  pq.status,
  pq."reviewStatus",
  pq."isDeleted",

  -- Activity features
  pq."areInstancesOutdated",
  pq."isGamificationEnabled",
  pq."isAssessmentEnabled",
  pq."pointsMultiplier",
  CAST(NULL AS TEXT) as "pinCode",

  -- Template information
  at.id as "templateId",
  pq."templateName",

  -- Timestamps
  pq."createdAt",
  pq."updatedAt",

  -- Type-specific scheduling fields
  pq."availableFrom",
  CAST(NULL AS TIMESTAMP(3)) as "scheduledStartAt",
  CAST(NULL AS TIMESTAMP(3)) as "scheduledEndAt",

  -- Course information
  c.id as "courseId",
  c.name as "courseName",
  c.language as "courseLanguage",
  c."startDate" as "courseStartDate",

  -- Group activity specific
  CAST(NULL AS TIMESTAMP(3)) as "groupDeadlineDate",
  CAST(NULL AS INTEGER) as "numOfParticipantGroups",

  -- Content metrics (count stacks and their elements)
  COALESCE(stack_counts.num_stacks, 0) as "numOfStacks",
  COALESCE(stack_counts.num_elements, 0) as "numOfElements",

  -- Permission fields
  dp."userId",
  dp."permissionLevel",
  dp.derived,

  -- Permission details for direct permissions
  p_direct.user_group_id as "directPermissionUserGroupId",

  -- Owner information
  pq."ownerId",

  -- Permission counts for numSharedUsers and isActivityReviewer calculation
  COALESCE(activity_perm_counts.num_permissions, 0) as "numActivityPermissions",
  COALESCE(course_perm_counts.is_user_course_admin, false) as "isUserCourseAdmin"

FROM "PracticeQuiz" pq
JOIN "DerivedPermission" dp ON dp."practiceQuizId" = pq.id
LEFT JOIN (
  SELECT p.id, p."userGroupId" as user_group_id
  FROM "Permission" p
) p_direct ON p_direct.id = dp."directPermissionId"
LEFT JOIN "ActivityTemplate" at ON at."practiceQuizId" = pq.id
LEFT JOIN "Course" c ON c.id = pq."courseId"
LEFT JOIN (
  SELECT
    es."practiceQuizId",
    COUNT(es.id) as num_stacks,
    COALESCE(SUM(ei_counts.element_count), 0) as num_elements
  FROM "ElementStack" es
  LEFT JOIN (
    SELECT
      ei."elementStackId",
      COUNT(ei.id) as element_count
    FROM "ElementInstance" ei
    GROUP BY ei."elementStackId"
  ) ei_counts ON ei_counts."elementStackId" = es.id
  WHERE es."practiceQuizId" IS NOT NULL
  GROUP BY es."practiceQuizId"
) stack_counts ON stack_counts."practiceQuizId" = pq.id
LEFT JOIN (
  SELECT
    p."practiceQuizId",
    COUNT(p.id) as num_permissions
  FROM "Permission" p
  WHERE p."practiceQuizId" IS NOT NULL
  GROUP BY p."practiceQuizId"
) activity_perm_counts ON activity_perm_counts."practiceQuizId" = pq.id
LEFT JOIN (
  SELECT
    p."courseId",
    p."userId",
    true as is_user_course_admin
  FROM "DerivedPermission" p
  WHERE p."courseId" IS NOT NULL
    AND p."permissionLevel" IN ('ADMIN', 'OWNER')
  GROUP BY p."courseId", p."userId"
) course_perm_counts ON course_perm_counts."courseId" = pq."courseId" AND course_perm_counts."userId" = dp."userId"

WHERE c."deletionRequestedAt" IS NULL
UNION ALL

SELECT
  -- Core activity fields
  ml.id,
  'MICRO_LEARNING' as type,
  3 as "typeOrder",
  ml.name,
  ml."displayName",
  ml.description,
  ml.status,
  ml."reviewStatus",
  ml."isDeleted",

  -- Activity features
  ml."areInstancesOutdated",
  ml."isGamificationEnabled",
  ml."isAssessmentEnabled",
  ml."pointsMultiplier",
  CAST(NULL AS TEXT) as "pinCode",

  -- Template information
  at.id as "templateId",
  ml."templateName",

  -- Timestamps
  ml."createdAt",
  ml."updatedAt",

  -- Type-specific scheduling fields
  NULL as "availableFrom",
  CAST(ml."scheduledStartAt" AS TIMESTAMP(3)) as "scheduledStartAt",
  CAST(ml."scheduledEndAt" AS TIMESTAMP(3)) as "scheduledEndAt",

  -- Course information
  c.id as "courseId",
  c.name as "courseName",
  c.language as "courseLanguage",
  c."startDate" as "courseStartDate",

  -- Group activity specific
  CAST(NULL AS TIMESTAMP(3)) as "groupDeadlineDate",
  CAST(NULL AS INTEGER) as "numOfParticipantGroups",

  -- Content metrics (count stacks and their elements)
  COALESCE(stack_counts.num_stacks, 0) as "numOfStacks",
  COALESCE(stack_counts.num_elements, 0) as "numOfElements",

  -- Permission fields
  dp."userId",
  dp."permissionLevel",
  dp.derived,

  -- Permission details for direct permissions
  p_direct.user_group_id as "directPermissionUserGroupId",

  -- Owner information
  ml."ownerId",

  -- Permission counts for numSharedUsers and isActivityReviewer calculation
  COALESCE(activity_perm_counts.num_permissions, 0) as "numActivityPermissions",
  COALESCE(course_perm_counts.is_user_course_admin, false) as "isUserCourseAdmin"

FROM "MicroLearning" ml
JOIN "DerivedPermission" dp ON dp."microLearningId" = ml.id
LEFT JOIN (
  SELECT p.id, p."userGroupId" as user_group_id
  FROM "Permission" p
) p_direct ON p_direct.id = dp."directPermissionId"
LEFT JOIN "ActivityTemplate" at ON at."microLearningId" = ml.id
LEFT JOIN "Course" c ON c.id = ml."courseId"
LEFT JOIN (
  SELECT
    es."microLearningId",
    COUNT(es.id) as num_stacks,
    COALESCE(SUM(ei_counts.element_count), 0) as num_elements
  FROM "ElementStack" es
  LEFT JOIN (
    SELECT
      ei."elementStackId",
      COUNT(ei.id) as element_count
    FROM "ElementInstance" ei
    GROUP BY ei."elementStackId"
  ) ei_counts ON ei_counts."elementStackId" = es.id
  WHERE es."microLearningId" IS NOT NULL
  GROUP BY es."microLearningId"
) stack_counts ON stack_counts."microLearningId" = ml.id
LEFT JOIN (
  SELECT
    p."microLearningId",
    COUNT(p.id) as num_permissions
  FROM "Permission" p
  WHERE p."microLearningId" IS NOT NULL
  GROUP BY p."microLearningId"
) activity_perm_counts ON activity_perm_counts."microLearningId" = ml.id
LEFT JOIN (
  SELECT
    p."courseId",
    p."userId",
    true as is_user_course_admin
  FROM "DerivedPermission" p
  WHERE p."courseId" IS NOT NULL
    AND p."permissionLevel" IN ('ADMIN', 'OWNER')
  GROUP BY p."courseId", p."userId"
) course_perm_counts ON course_perm_counts."courseId" = ml."courseId" AND course_perm_counts."userId" = dp."userId"

WHERE c."deletionRequestedAt" IS NULL
UNION ALL

SELECT
  -- Core activity fields
  ga.id,
  'GROUP_ACTIVITY' as type,
  4 as "typeOrder",
  ga.name,
  ga."displayName",
  ga.description,
  ga.status,
  ga."reviewStatus",
  ga."isDeleted",

  -- Activity features
  ga."areInstancesOutdated",
  ga."isGamificationEnabled",
  ga."isAssessmentEnabled",
  ga."pointsMultiplier",
  CAST(NULL AS TEXT) as "pinCode",

  -- Template information
  at.id as "templateId",
  ga."templateName",

  -- Timestamps
  ga."createdAt",
  ga."updatedAt",

  -- Type-specific scheduling fields
  NULL as "availableFrom",
  ga."scheduledStartAt",
  ga."scheduledEndAt",

  -- Course information
  c.id as "courseId",
  c.name as "courseName",
  c.language as "courseLanguage",
  c."startDate" as "courseStartDate",

  -- Group activity specific
  c."groupDeadlineDate",
  course_stats.num_participant_groups as "numOfParticipantGroups",

  -- Content metrics (count stacks and their elements)
  COALESCE(stack_counts.num_stacks, 0) as "numOfStacks",
  COALESCE(stack_counts.num_elements, 0) as "numOfElements",

  -- Permission fields
  dp."userId",
  dp."permissionLevel",
  dp.derived,

  -- Permission details for direct permissions
  p_direct.user_group_id as "directPermissionUserGroupId",

  -- Owner information
  ga."ownerId",

  -- Permission counts for numSharedUsers and isActivityReviewer calculation
  COALESCE(activity_perm_counts.num_permissions, 0) as "numActivityPermissions",
  COALESCE(course_perm_counts.is_user_course_admin, false) as "isUserCourseAdmin"

FROM "GroupActivity" ga
JOIN "DerivedPermission" dp ON dp."groupActivityId" = ga.id
LEFT JOIN (
  SELECT p.id, p."userGroupId" as user_group_id
  FROM "Permission" p
) p_direct ON p_direct.id = dp."directPermissionId"
LEFT JOIN "ActivityTemplate" at ON at."groupActivityId" = ga.id
LEFT JOIN "Course" c ON c.id = ga."courseId"
LEFT JOIN (
  SELECT
    es."groupActivityId",
    COUNT(es.id) as num_stacks,
    COALESCE(SUM(ei_counts.element_count), 0) as num_elements
  FROM "ElementStack" es
  LEFT JOIN (
    SELECT
      ei."elementStackId",
      COUNT(ei.id) as element_count
    FROM "ElementInstance" ei
    GROUP BY ei."elementStackId"
  ) ei_counts ON ei_counts."elementStackId" = es.id
  WHERE es."groupActivityId" IS NOT NULL
  GROUP BY es."groupActivityId"
) stack_counts ON stack_counts."groupActivityId" = ga.id
LEFT JOIN (
  SELECT
    pg."courseId",
    COUNT(pg.id) as num_participant_groups
  FROM "ParticipantGroup" pg
  GROUP BY pg."courseId"
) course_stats ON course_stats."courseId" = ga."courseId"
LEFT JOIN (
  SELECT
    p."groupActivityId",
    COUNT(p.id) as num_permissions
  FROM "Permission" p
  WHERE p."groupActivityId" IS NOT NULL
  GROUP BY p."groupActivityId"
) activity_perm_counts ON activity_perm_counts."groupActivityId" = ga.id
LEFT JOIN (
  SELECT
    p."courseId",
    p."userId",
    true as is_user_course_admin
  FROM "DerivedPermission" p
  WHERE p."courseId" IS NOT NULL
    AND p."permissionLevel" IN ('ADMIN', 'OWNER')
  GROUP BY p."courseId", p."userId"
) course_perm_counts ON course_perm_counts."courseId" = ga."courseId" AND course_perm_counts."userId" = dp."userId"
WHERE c."deletionRequestedAt" IS NULL;
