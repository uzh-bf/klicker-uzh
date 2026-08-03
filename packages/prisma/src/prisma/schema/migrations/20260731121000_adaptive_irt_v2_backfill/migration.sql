-- Guard and migrate legacy adaptive-learning rows into immutable v1 records.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "CompetenceTree"
    WHERE "thetaMin"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "thetaMax"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "defaultDiscrimination"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "thetaMin" >= "thetaMax"
       OR "defaultDiscrimination" <= 0
  ) THEN
    RAISE EXCEPTION 'Adaptive IRT v2 backfill rejected invalid competence-tree geometry';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "CompetenceTreeLevel"
    GROUP BY "treeId"
    HAVING min("order") <> 0
       OR max("order") <> count(*) - 1
       OR count(DISTINCT "order") <> count(*)
  ) THEN
    RAISE EXCEPTION 'Adaptive IRT v2 backfill requires contiguous zero-based level orders';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "CompetenceTreeElementAssignment" assignment
    JOIN "Element" element ON element.id = assignment."elementId"
    WHERE element.version IS NULL OR element.version < 1
  ) THEN
    RAISE EXCEPTION 'Adaptive IRT v2 backfill requires positive element versions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "PracticeQuizAdaptivePoolItem"
    GROUP BY "configId", "sourceAssignmentId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Adaptive IRT v2 backfill found duplicate active pool assignments';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "PracticeQuizAdaptivePoolItem" pool
    JOIN "PracticeQuizAdaptiveConfig" config ON config.id = pool."configId"
    JOIN "CompetenceTreeElementAssignment" assignment ON assignment.id = pool."sourceAssignmentId"
    JOIN "Element" element ON element.id = assignment."elementId"
    WHERE pool."competenceTreeId" <> config."competenceTreeId"
       OR assignment."treeId" <> config."competenceTreeId"
       OR pool."elementId" <> assignment."elementId"
       OR pool."elementVersion" < 1
       OR pool."elementVersion" > element.version
  ) THEN
    RAISE EXCEPTION 'Adaptive IRT v2 backfill found an inconsistent legacy publication pool';
  END IF;
END $$;

INSERT INTO "CompetenceTreeScaleVersion" (
  "id",
  "version",
  "status",
  "priorMean",
  "priorStandardDeviation",
  "gridMin",
  "gridMax",
  "gridStep",
  "classificationPolicyVersion",
  "treeId",
  "createdById",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('adaptive-scale:' || tree.id::text)::uuid,
  1,
  'DRAFT'::"AdaptiveScaleVersionStatus",
  0,
  1,
  least(-6, tree."thetaMin"),
  greatest(6, tree."thetaMax"),
  0.1,
  1,
  tree.id,
  tree."ownerId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CompetenceTree" tree;

WITH ordered_levels AS (
  SELECT
    level.id,
    level."treeId",
    level.label,
    level."order",
    tree."thetaMin",
    tree."thetaMax",
    tree."levelMappingRule",
    count(*) OVER (PARTITION BY level."treeId")::double precision AS level_count
  FROM "CompetenceTreeLevel" level
  JOIN "CompetenceTree" tree ON tree.id = level."treeId"
), anchored_levels AS (
  SELECT
    *,
    CASE
      WHEN level_count = 1 THEN ("thetaMin" + "thetaMax") / 2
      WHEN "levelMappingRule" = 'NEAREST'::"AdaptiveLevelMappingRule"
        THEN "thetaMin" + ("thetaMax" - "thetaMin") * "order" / (level_count - 1)
      ELSE "thetaMin" + ("thetaMax" - "thetaMin") * "order" / level_count
    END AS anchor
  FROM ordered_levels
)
INSERT INTO "CompetenceTreeScaleLevel" (
  "order",
  "label",
  "lowerBound",
  "itemDifficultyPrior",
  "treeId",
  "scaleVersionId",
  "sourceLevelId"
)
SELECT
  "order",
  label,
  CASE
    WHEN "order" = 0 THEN NULL
    WHEN "levelMappingRule" = 'NEAREST'::"AdaptiveLevelMappingRule"
      THEN (lag(anchor) OVER (PARTITION BY "treeId" ORDER BY "order") + anchor) / 2
    ELSE anchor
  END,
  anchor,
  "treeId",
  md5('adaptive-scale:' || "treeId"::text)::uuid,
  id
FROM anchored_levels;

WITH legacy_item_sources AS (
  SELECT
    assignment.id AS assignment_id,
    assignment."treeId" AS tree_id,
    assignment."elementId" AS element_id,
    element.version AS element_version,
    element.type AS element_type,
    element.content || ':' || element.options::text AS content_payload,
    coalesce(assignment.discrimination, tree."defaultDiscrimination") AS discrimination,
    scale_level."itemDifficultyPrior" AS difficulty,
    coalesce(
      (
        SELECT pool.guessing
        FROM "PracticeQuizAdaptivePoolItem" pool
        WHERE pool."sourceAssignmentId" = assignment.id
          AND pool."elementVersion" = element.version
        ORDER BY pool.id
        LIMIT 1
      ),
      CASE element.type
        WHEN 'SC'::"ElementType" THEN 1.0 / greatest(
          CASE WHEN jsonb_typeof(element.options -> 'choices') = 'array'
            THEN jsonb_array_length(element.options -> 'choices') ELSE 4 END,
          2
        )
        WHEN 'MC'::"ElementType" THEN 1.0 / greatest(
          power(2, CASE WHEN jsonb_typeof(element.options -> 'choices') = 'array'
            THEN jsonb_array_length(element.options -> 'choices') ELSE 4 END) - 1,
          1
        )
        WHEN 'KPRIM'::"ElementType" THEN 1.0 / power(
          2,
          CASE WHEN jsonb_typeof(element.options -> 'choices') = 'array'
            THEN jsonb_array_length(element.options -> 'choices') ELSE 4 END
        )
        ELSE 0
      END
    ) AS guessing,
    1 AS source_priority
  FROM "CompetenceTreeElementAssignment" assignment
  JOIN "CompetenceTree" tree ON tree.id = assignment."treeId"
  JOIN "Element" element ON element.id = assignment."elementId"
  JOIN "CompetenceTreeScaleLevel" scale_level
    ON scale_level."treeId" = assignment."treeId"
   AND scale_level."sourceLevelId" = assignment."levelId"
  UNION ALL
  SELECT
    pool."sourceAssignmentId",
    pool."competenceTreeId",
    pool."elementId",
    pool."elementVersion",
    pool."elementType",
    pool."elementData"::text,
    pool.discrimination,
    pool.difficulty,
    pool.guessing,
    0
  FROM "PracticeQuizAdaptivePoolItem" pool
), legacy_item_parameters AS (
  SELECT DISTINCT ON (assignment_id, element_version)
    assignment_id,
    tree_id,
    element_id,
    element_version,
    element_type,
    content_payload,
    discrimination,
    difficulty,
    guessing
  FROM legacy_item_sources
  ORDER BY assignment_id, element_version, source_priority
)
INSERT INTO "AdaptiveItemCalibration" (
  "id",
  "version",
  "model",
  "status",
  "discrimination",
  "difficulty",
  "guessing",
  "parameterUncertainty",
  "responseCount",
  "participantCount",
  "diagnostics",
  "datasetVersion",
  "datasetChecksum",
  "modelImplementationVersion",
  "elementContentChecksum",
  "treeId",
  "scaleVersionId",
  "assignmentId",
  "elementId",
  "elementVersion",
  "createdAt",
  "updatedAt"
)
SELECT
  md5('adaptive-calibration:' || assignment_id::text || ':' || element_version::text || ':1')::uuid,
  1,
  CASE
    WHEN element_type IN ('NUMERICAL'::"ElementType", 'FREE_TEXT'::"ElementType")
      THEN 'TWO_PL'::"AdaptiveItemModel"
    ELSE 'THREE_PL_FIXED_C'::"AdaptiveItemModel"
  END,
  'PROVISIONAL'::"AdaptiveItemCalibrationStatus",
  discrimination,
  difficulty,
  guessing,
  jsonb_build_object(
    'discriminationStandardError', NULL,
    'difficultyStandardError', NULL,
    'guessingStandardError', NULL,
    'discriminationInterval', NULL,
    'difficultyInterval', NULL,
    'guessingInterval', NULL
  ),
  0,
  0,
  jsonb_build_object(
    'fitStatus', 'WARN',
    'difStatus', 'WARN',
    'driftStatus', 'WARN',
    'fitStatistics', '{}'::jsonb,
    'warningCodes', jsonb_build_array('LEGACY_AUTHOR_PRIOR_NOT_EMPIRICALLY_CALIBRATED'),
    'dif', '{}'::jsonb,
    'drift', '{}'::jsonb
  ),
  'legacy-author-prior-v1',
  'legacy-md5:' || md5(tree_id::text || ':' || assignment_id::text || ':' || element_version::text),
  'irt-v1-author-prior',
  'legacy-md5:' || md5(
    element_id::text || ':' || element_version::text || ':' || content_payload
  ),
  tree_id,
  md5('adaptive-scale:' || tree_id::text)::uuid,
  assignment_id,
  element_id,
  element_version,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM legacy_item_parameters;

INSERT INTO "PracticeQuizAdaptivePublication" (
  "id",
  "version",
  "configId",
  "competenceTreeId",
  "scaleVersionId",
  "measurementVersion",
  "preset",
  "estimatorImplementationVersion",
  "classificationPolicyVersion",
  "calibrationPolicyVersion",
  "cutScoreSnapshot",
  "priorMean",
  "priorStandardDeviation",
  "gridMin",
  "gridMax",
  "gridStep",
  "classificationProbabilityThreshold",
  "hierarchicalWeightSnapshot",
  "evidenceMinimumSnapshot",
  "totalQuestionCap",
  "showTimer",
  "questionCapSnapshot",
  "candidateSetPolicyVersion",
  "randomizationPolicyVersion",
  "exposureCeiling",
  "overlapPolicyVersion",
  "retakePolicy",
  "retakeCooldownDays",
  "researchAllocationPolicy",
  "stoppingPolicyVersion",
  "rolloutPolicyVersion",
  "publishedAt",
  "unpublishedAt",
  "createdAt"
)
SELECT
  md5('adaptive-publication:' || config.id::text || ':1')::uuid,
  1,
  config.id,
  config."competenceTreeId",
  md5('adaptive-scale:' || config."competenceTreeId"::text)::uuid,
  'IRT_V1'::"AdaptiveMeasurementVersion",
  config.preset,
  'irt-v1-legacy',
  1,
  1,
  coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'scaleLevelId', scale_level.id,
      'sourceLevelId', scale_level."sourceLevelId",
      'order', scale_level."order",
      'label', scale_level.label,
      'lowerBound', scale_level."lowerBound",
      'itemDifficultyPrior', scale_level."itemDifficultyPrior"
    ) ORDER BY scale_level."order")
    FROM "CompetenceTreeScaleLevel" scale_level
    WHERE scale_level."scaleVersionId" = md5('adaptive-scale:' || config."competenceTreeId"::text)::uuid
  ), '[]'::jsonb),
  0,
  1,
  least(-6, tree."thetaMin"),
  greatest(6, tree."thetaMax"),
  0.1,
  NULL,
  coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'nodeId', hierarchy.id,
      'name', hierarchy.name,
      'parentId', hierarchy."parentId",
      'kind', hierarchy.kind,
      'depth', hierarchy.depth,
      'order', hierarchy."order",
      'nodePath', hierarchy.node_path,
      'enabled', hierarchy.enabled,
      'normalizedWeight', hierarchy.normalized_weight,
      'effectiveLeafWeight', CASE WHEN hierarchy.is_leaf THEN hierarchy.effective_weight ELSE NULL END
    ) ORDER BY hierarchy.node_path)
    FROM (
      WITH RECURSIVE effective_nodes AS (
        SELECT
          node.id,
          node.name,
          node."parentId",
          node.kind,
          node.depth,
          node."order",
          coalesce(override.enabled, true) AS enabled,
          coalesce(override.weight, node.weight) AS weight
        FROM "CompetenceTreeNode" node
        LEFT JOIN "PracticeQuizAdaptiveNodeOverride" override
          ON override."configId" = config.id AND override."nodeId" = node.id
        WHERE node."treeId" = config."competenceTreeId"
      ), hierarchy AS (
        SELECT
          node.id,
          node.name,
          node."parentId",
          node.kind,
          node.depth,
          node."order",
          ARRAY[node.id] AS node_path,
          node.enabled,
          CASE WHEN node.enabled THEN node.weight / NULLIF(sum(node.weight) FILTER (WHERE node.enabled) OVER (), 0) ELSE 0 END AS normalized_weight,
          CASE WHEN node.enabled THEN node.weight / NULLIF(sum(node.weight) FILTER (WHERE node.enabled) OVER (), 0) ELSE 0 END AS effective_weight
        FROM effective_nodes node
        WHERE node."parentId" IS NULL

        UNION ALL

        SELECT
          child.id,
          child.name,
          child."parentId",
          child.kind,
          child.depth,
          child."order",
          parent.node_path || child.id,
          parent.enabled AND child.enabled,
          CASE
            WHEN parent.enabled AND child.enabled THEN child.weight / NULLIF((
              SELECT sum(sibling.weight) FROM effective_nodes sibling
              WHERE sibling."parentId" = child."parentId" AND sibling.enabled
            ), 0)
            ELSE 0
          END,
          parent.effective_weight * CASE
            WHEN parent.enabled AND child.enabled THEN child.weight / NULLIF((
              SELECT sum(sibling.weight) FROM effective_nodes sibling
              WHERE sibling."parentId" = child."parentId" AND sibling.enabled
            ), 0)
            ELSE 0
          END
        FROM effective_nodes child
        JOIN hierarchy parent ON parent.id = child."parentId"
      )
      SELECT
        hierarchy.*,
        NOT EXISTS (SELECT 1 FROM effective_nodes child WHERE child."parentId" = hierarchy.id) AS is_leaf
      FROM hierarchy
    ) hierarchy
  ), '[]'::jsonb),
  jsonb_build_object(
    'minimumResponsesPerLeaf', config."minQuestionsPerLeaf",
    'minimumResponsesPerRoot', config."minQuestionsPerLeaf",
    'classificationZ', config."classificationZ",
    'topInformationRatio', config."topInformationRatio",
    'levelMappingRule', config."levelMappingRule",
    'thetaMin', tree."thetaMin",
    'thetaMax', tree."thetaMax",
    'requiredRootIds', coalesce((
      SELECT jsonb_agg(node.id ORDER BY node."order", node.id)
      FROM "CompetenceTreeNode" node
      LEFT JOIN "PracticeQuizAdaptiveNodeOverride" override
        ON override."configId" = config.id AND override."nodeId" = node.id
      WHERE node."treeId" = config."competenceTreeId"
        AND node."parentId" IS NULL
        AND coalesce(override.enabled, true)
    ), '[]'::jsonb)
  ),
  config."totalQuestionCap",
  config."showTimer",
  jsonb_build_object(
    'root', coalesce((
      SELECT jsonb_object_agg(node.id::text, override."questionCap" ORDER BY node.id)
      FROM "CompetenceTreeNode" node
      LEFT JOIN "PracticeQuizAdaptiveNodeOverride" override
        ON override."configId" = config.id AND override."nodeId" = node.id
      WHERE node."treeId" = config."competenceTreeId" AND node."parentId" IS NULL
    ), '{}'::jsonb),
    'node', coalesce((
      SELECT jsonb_object_agg(node.id::text, override."questionCap" ORDER BY node.id)
      FROM "CompetenceTreeNode" node
      LEFT JOIN "PracticeQuizAdaptiveNodeOverride" override
        ON override."configId" = config.id AND override."nodeId" = node.id
      WHERE node."treeId" = config."competenceTreeId"
    ), '{}'::jsonb),
    'leaf', coalesce((
      SELECT jsonb_object_agg(node.id::text, config."perLeafQuestionCap" ORDER BY node.id)
      FROM "CompetenceTreeNode" node
      WHERE node."treeId" = config."competenceTreeId"
        AND NOT EXISTS (
          SELECT 1 FROM "CompetenceTreeNode" child
          WHERE child."treeId" = node."treeId" AND child."parentId" = node.id
        )
    ), '{}'::jsonb)
  ),
  'irt-v1-max-information',
  'irt-v1-deterministic',
  1,
  'irt-v1-no-exposure-control',
  config."attemptSelectionPolicy",
  quiz."resetTimeDays",
  NULL,
  'irt-v1-z-interval',
  1,
  coalesce(config."poolPublishedAt", config."createdAt"),
  CASE WHEN EXISTS (
    SELECT 1 FROM "PracticeQuizAdaptivePoolItem" pool WHERE pool."configId" = config.id
  ) THEN NULL ELSE CURRENT_TIMESTAMP END,
  CURRENT_TIMESTAMP
FROM "PracticeQuizAdaptiveConfig" config
JOIN "CompetenceTree" tree ON tree.id = config."competenceTreeId"
JOIN "PracticeQuiz" quiz ON quiz.id = config."practiceQuizId"
WHERE EXISTS (
  SELECT 1 FROM "PracticeQuizAdaptivePoolItem" pool WHERE pool."configId" = config.id
) OR EXISTS (
  SELECT 1 FROM "AdaptivePracticeQuizAttempt" attempt WHERE attempt."configId" = config.id
);

UPDATE "AdaptivePracticeQuizCohortSnapshot" snapshot
SET
  "publicationId" = publication.id,
  "scaleVersionId" = publication."scaleVersionId",
  "measurementVersion" = publication."measurementVersion"
FROM "PracticeQuizAdaptivePublication" publication
WHERE publication."configId" = snapshot."configId"
  AND publication.version = 1;

UPDATE "PracticeQuizAdaptiveConfig" config
SET
  "measurementVersion" = 'IRT_V1'::"AdaptiveMeasurementVersion",
  "calibrationPolicyVersion" = 1,
  "scaleVersionId" = md5('adaptive-scale:' || config."competenceTreeId"::text)::uuid;

UPDATE "PracticeQuizAdaptivePoolItem" pool
SET
  "publicationId" = md5('adaptive-publication:' || pool."configId"::text || ':1')::uuid,
  "scaleVersionId" = md5('adaptive-scale:' || pool."competenceTreeId"::text)::uuid,
  "calibrationId" = calibration.id,
  "measurementVersion" = 'IRT_V1'::"AdaptiveMeasurementVersion",
  "calibrationVersion" = calibration.version,
  "calibrationStatus" = calibration.status,
  "itemModel" = calibration.model,
  "modelImplementationVersion" = calibration."modelImplementationVersion",
  "role" = 'SCORING'::"AdaptivePoolItemRole",
  "contributesToEstimate" = true
FROM "AdaptiveItemCalibration" calibration
WHERE calibration."assignmentId" = pool."sourceAssignmentId"
  AND calibration."elementId" = pool."elementId"
  AND calibration."elementVersion" = pool."elementVersion"
  AND calibration.version = 1;

UPDATE "AdaptivePracticeQuizAttempt" attempt
SET
  "publicationId" = md5('adaptive-publication:' || attempt."configId"::text || ':1')::uuid,
  "scaleVersionId" = md5('adaptive-scale:' || attempt."competenceTreeId"::text)::uuid,
  "measurementVersion" = 'IRT_V1'::"AdaptiveMeasurementVersion",
  "estimatorImplementationVersion" = 'irt-v1-legacy',
  "classificationPolicyVersion" = 1,
  "calibrationPolicyVersion" = 1,
  "finalScaleLevelId" = scale_level.id
FROM "CompetenceTreeScaleLevel" scale_level
WHERE scale_level."treeId" = attempt."competenceTreeId"
  AND scale_level."sourceLevelId" = attempt."finalLevelId";

UPDATE "AdaptivePracticeQuizAttempt" attempt
SET
  "publicationId" = md5('adaptive-publication:' || attempt."configId"::text || ':1')::uuid,
  "scaleVersionId" = md5('adaptive-scale:' || attempt."competenceTreeId"::text)::uuid,
  "measurementVersion" = 'IRT_V1'::"AdaptiveMeasurementVersion",
  "estimatorImplementationVersion" = 'irt-v1-legacy',
  "classificationPolicyVersion" = 1,
  "calibrationPolicyVersion" = 1
WHERE attempt."publicationId" IS NULL;

UPDATE "AdaptivePracticeQuizResponse" response
SET "publicationId" = attempt."publicationId"
FROM "AdaptivePracticeQuizAttempt" attempt
WHERE attempt.id = response."attemptId";

UPDATE "PracticeQuizAdaptivePublication"
SET "sealedAt" = CURRENT_TIMESTAMP
WHERE "sealedAt" IS NULL;

COMMIT;
