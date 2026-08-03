import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Client, type DatabaseError } from 'pg'

const PHASE_10_FIRST_MIGRATION =
  '20260713210000_adaptive_runtime_constraint_validation'
const IRT_V2_MIGRATIONS = [
  '20260731120000_adaptive_irt_v2_records',
  '20260731121000_adaptive_irt_v2_backfill',
  '20260731122000_adaptive_irt_v2_constraints',
  '20260731123000_adaptive_irt_v2_export_artifacts',
] as const
const IRT_V2_FIRST_MIGRATION = IRT_V2_MIGRATIONS[0]
const IRT_V2_LAST_MIGRATION = IRT_V2_MIGRATIONS.at(-1)!

const migrationsPath = fileURLToPath(
  new URL('../prisma/schema/migrations/', import.meta.url)
)
const phase10FixturePath = fileURLToPath(
  new URL(
    '../prisma/fixtures/adaptive-learning-phase10-pre-repair.sql',
    import.meta.url
  )
)
const irtV2FixturePath = fileURLToPath(
  new URL(
    '../prisma/fixtures/adaptive-irt-v2-pre-migration.sql',
    import.meta.url
  )
)

async function main() {
  const sourceDatabaseUrl = process.env.DATABASE_URL
  if (!sourceDatabaseUrl) {
    throw new Error('DATABASE_URL is required for the migration rehearsal.')
  }

  const migrationNames = (
    await readdir(migrationsPath, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name <= IRT_V2_LAST_MIGRATION)
    .sort()

  for (const migration of IRT_V2_MIGRATIONS) {
    assert(migrationNames.includes(migration), `Missing migration ${migration}`)
  }

  const admin = new Client({ connectionString: sourceDatabaseUrl })
  await admin.connect()
  try {
    await withTemporaryDatabase(
      admin,
      sourceDatabaseUrl,
      'clean',
      async (database) => {
        await applyMigrations(database, migrationNames)
        await verifyCleanReplay(database)
      }
    )

    await withTemporaryDatabase(
      admin,
      sourceDatabaseUrl,
      'populated',
      async (database) => {
        await preparePopulatedPreIrtDatabase(database, migrationNames)
        await applyMigrations(database, [...IRT_V2_MIGRATIONS])
        await verifyPopulatedReplay(database)
      }
    )

    await withTemporaryDatabase(
      admin,
      sourceDatabaseUrl,
      'atomic',
      async (database) => {
        await preparePopulatedPreIrtDatabase(database, migrationNames)
        await applyMigrations(database, [IRT_V2_MIGRATIONS[0]])
        await database.query(`
          CREATE FUNCTION fail_adaptive_calibration_insert()
          RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            RAISE EXCEPTION 'intentional late backfill failure';
          END $$;
          CREATE TRIGGER fail_adaptive_calibration_insert
          BEFORE INSERT ON "AdaptiveItemCalibration"
          FOR EACH ROW EXECUTE FUNCTION fail_adaptive_calibration_insert();
        `)
        await assert.rejects(applyMigrations(database, [IRT_V2_MIGRATIONS[1]]))
        await database.query('ROLLBACK')
        const scales = await database.query<{ count: number }>(`
          SELECT count(*)::integer AS count FROM "CompetenceTreeScaleVersion"
        `)
        assert.equal(scales.rows[0]?.count, 0)
      }
    )
  } finally {
    await admin.end()
  }

  console.log(
    `Adaptive IRT v2 clean and populated migration rehearsals passed across ${migrationNames.length} migrations.`
  )
}

async function withTemporaryDatabase(
  admin: Client,
  sourceDatabaseUrl: string,
  suffix: string,
  verify: (database: Client) => Promise<void>
) {
  const databaseName = `adaptive_irt_v2_${suffix}_${process.pid}_${Date.now()}`
  const databaseUrl = new URL(sourceDatabaseUrl)
  databaseUrl.pathname = `/${databaseName}`
  const database = new Client({ connectionString: databaseUrl.href })

  await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`)
  try {
    await database.connect()
    await verify(database)
  } finally {
    await database.end().catch(() => undefined)
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName]
    )
    await admin.query(
      `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`
    )
  }
}

async function applyMigrations(client: Client, migrationNames: string[]) {
  for (const migrationName of migrationNames) {
    await applySqlFile(
      client,
      `${migrationsPath}/${migrationName}/migration.sql`,
      migrationName
    )
  }
}

async function preparePopulatedPreIrtDatabase(
  database: Client,
  migrationNames: string[]
) {
  const prePhase10 = migrationNames.filter(
    (name) => name < PHASE_10_FIRST_MIGRATION
  )
  const phase10ToPreIrt = migrationNames.filter(
    (name) => name >= PHASE_10_FIRST_MIGRATION && name < IRT_V2_FIRST_MIGRATION
  )

  await applyMigrations(database, prePhase10)
  await applySqlFile(database, phase10FixturePath, 'Phase 10 populated fixture')
  await applyMigrations(database, phase10ToPreIrt)
  await applySqlFile(
    database,
    irtV2FixturePath,
    'adaptive IRT v2 populated fixture'
  )
}

async function applySqlFile(client: Client, path: string, label: string) {
  const sql = await readFile(path, 'utf8')
  try {
    await client.query(sql)
  } catch (error) {
    throw new Error(`Failed while applying ${label}.`, { cause: error })
  }
}

async function verifyCleanReplay(client: Client) {
  const records = await client.query<{ relation: string | null }>(`
    SELECT to_regclass('"CompetenceTreeScaleVersion"')::text AS relation
    UNION ALL
    SELECT to_regclass('"AdaptiveItemCalibration"')::text
    UNION ALL
    SELECT to_regclass('"PracticeQuizAdaptivePublication"')::text
    UNION ALL
    SELECT to_regclass('"AdaptivePracticeQuizItemExposure"')::text
  `)
  assert.equal(records.rowCount, 4)
  assert(records.rows.every(({ relation }) => relation !== null))

  const requiredColumns = await client.query<{ count: number }>(`
    SELECT count(*)::integer AS count
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND (table_name, column_name) IN (
        ('PracticeQuizAdaptivePoolItem', 'publicationId'),
        ('AdaptivePracticeQuizAttempt', 'measurementVersion'),
        ('AdaptivePracticeQuizResponse', 'administrationProbability'),
        ('AdaptivePracticeQuizEstimate', 'bandProbabilities'),
        ('AdaptiveCalibrationExportRequest', 'datasetVersion'),
        ('AdaptiveCalibrationExportRequest', 'manifestArtifactKey'),
        ('AdaptiveCalibrationExportRequest', 'holdoutArtifactKey'),
        ('AdaptiveCalibrationExportRequest', 'criterionArtifactKey'),
        ('AdaptivePracticeQuizEmpiricalValidation', 'exportRequestId'),
        ('AdaptivePracticeQuizEmpiricalValidation', 'validationProtocolVersion'),
        ('AdaptivePracticeQuizEmpiricalValidation', 'criterionArtifactChecksum')
      )
  `)
  assert.equal(requiredColumns.rows[0]?.count, 11)

  const poolCalibrationIdentity = await client.query<{ definition: string }>(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conname = 'PracticeQuizAdaptivePoolItem_competenceTreeId_scaleVersion_fkey'
  `)
  assert.match(
    poolCalibrationIdentity.rows[0]?.definition ?? '',
    /sourceAssignmentId.*elementId.*elementVersion/
  )

  const validationEvidenceIdentity = await client.query<{
    definition: string
  }>(`
    SELECT indexdef AS definition
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'apqev_evidence_identity_key'
  `)
  assert.match(
    validationEvidenceIdentity.rows[0]?.definition ?? '',
    /exportRequestId.*criterionArtifactChecksum/
  )

  const validationLifecycleGuard = await client.query<{
    definition: string
  }>(`
    SELECT pg_get_functiondef(oid) AS definition
    FROM pg_proc
    WHERE proname = 'adaptive_review_evidence_immutability_guard'
      AND pg_function_is_visible(oid)
  `)
  assert.match(
    validationLifecycleGuard.rows[0]?.definition ?? '',
    /Illegal empirical-validation status transition/
  )
  assert.match(
    validationLifecycleGuard.rows[0]?.definition ?? '',
    /Active adaptive publications must be invalidated/
  )

  const validationInsertGuard = await client.query<{
    definition: string
  }>(`
    SELECT pg_get_functiondef(oid) AS definition
    FROM pg_proc
    WHERE proname = 'adaptive_independent_review_guard'
      AND pg_function_is_visible(oid)
  `)
  assert.match(
    validationInsertGuard.rows[0]?.definition ?? '',
    /Empirical-validation evidence must enter an unreviewed lifecycle state/
  )

  const migrationOnlyObjects = await client.query<{
    name: string
    kind: string
  }>(`
    SELECT conname AS name, 'constraint' AS kind
    FROM pg_constraint
    WHERE conname = 'aic_assignment_element_identity_fkey'
    UNION ALL
    SELECT indexname, 'index'
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN (
        'ctea_tree_id_element_key',
        'ctsv_one_active_per_tree_key',
        'pqap_one_active_per_config_key'
      )
    UNION ALL
    SELECT DISTINCT trigger_name, 'trigger'
    FROM information_schema.triggers
    WHERE trigger_schema = current_schema()
      AND trigger_name IN (
        'aic_immutability_guard',
        'apqa_sealed_publication_guard',
        'apqr_design_identity_guard',
        'ctsa_evidence_immutability_guard',
        'ctsl_lifecycle_guard',
        'ctslk_lifecycle_guard',
        'pqap_publication_guard',
        'pqapi_snapshot_guard'
      )
    ORDER BY kind, name
  `)
  assert.deepEqual(migrationOnlyObjects.rows, [
    { name: 'aic_assignment_element_identity_fkey', kind: 'constraint' },
    { name: 'ctea_tree_id_element_key', kind: 'index' },
    { name: 'ctsv_one_active_per_tree_key', kind: 'index' },
    { name: 'pqap_one_active_per_config_key', kind: 'index' },
    { name: 'aic_immutability_guard', kind: 'trigger' },
    { name: 'apqa_sealed_publication_guard', kind: 'trigger' },
    { name: 'apqr_design_identity_guard', kind: 'trigger' },
    { name: 'ctsa_evidence_immutability_guard', kind: 'trigger' },
    { name: 'ctsl_lifecycle_guard', kind: 'trigger' },
    { name: 'ctslk_lifecycle_guard', kind: 'trigger' },
    { name: 'pqap_publication_guard', kind: 'trigger' },
    { name: 'pqapi_snapshot_guard', kind: 'trigger' },
  ])
}

async function verifyPopulatedReplay(client: Client) {
  const scales = await client.query<{
    treeId: string
    order: number
    lowerBound: number | null
    itemDifficultyPrior: number
    status: string
  }>(`
    SELECT
      scale."treeId" AS "treeId",
      level."order",
      level."lowerBound" AS "lowerBound",
      level."itemDifficultyPrior" AS "itemDifficultyPrior",
      scale.status::text
    FROM "CompetenceTreeScaleVersion" scale
    JOIN "CompetenceTreeScaleLevel" level ON level."scaleVersionId" = scale.id
    ORDER BY scale."treeId", level."order"
  `)
  assert.deepEqual(scales.rows, [
    {
      treeId: '91000000-0000-4000-8000-000000000003',
      order: 0,
      lowerBound: null,
      itemDifficultyPrior: 0,
      status: 'DRAFT',
    },
    {
      treeId: '92000000-0000-4000-8000-000000000001',
      order: 0,
      lowerBound: null,
      itemDifficultyPrior: -3,
      status: 'DRAFT',
    },
    {
      treeId: '92000000-0000-4000-8000-000000000001',
      order: 1,
      lowerBound: -1,
      itemDifficultyPrior: -1,
      status: 'DRAFT',
    },
    {
      treeId: '92000000-0000-4000-8000-000000000001',
      order: 2,
      lowerBound: 1,
      itemDifficultyPrior: 1,
      status: 'DRAFT',
    },
    {
      treeId: '92000000-0000-4000-8000-000000000002',
      order: 0,
      lowerBound: null,
      itemDifficultyPrior: -3,
      status: 'DRAFT',
    },
    {
      treeId: '92000000-0000-4000-8000-000000000002',
      order: 1,
      lowerBound: -1.5,
      itemDifficultyPrior: 0,
      status: 'DRAFT',
    },
    {
      treeId: '92000000-0000-4000-8000-000000000002',
      order: 2,
      lowerBound: 1.5,
      itemDifficultyPrior: 3,
      status: 'DRAFT',
    },
    {
      treeId: '92000000-0000-4000-8000-000000000003',
      order: 0,
      lowerBound: null,
      itemDifficultyPrior: -1,
      status: 'DRAFT',
    },
  ])

  const config = await client.query<{
    measurementVersion: string
    calibrationPolicyVersion: number
    hasScale: boolean
  }>(`
    SELECT
      "measurementVersion"::text AS "measurementVersion",
      "calibrationPolicyVersion" AS "calibrationPolicyVersion",
      "scaleVersionId" IS NOT NULL AS "hasScale"
    FROM "PracticeQuizAdaptiveConfig"
  `)
  assert.deepEqual(config.rows, [
    {
      measurementVersion: 'IRT_V1',
      calibrationPolicyVersion: 1,
      hasScale: true,
    },
  ])

  const publication = await client.query<{
    measurementVersion: string
    estimatorImplementationVersion: string
    poolItems: number
    attempts: number
    validations: number
    sealed: boolean
  }>(`
    SELECT
      publication."measurementVersion"::text AS "measurementVersion",
      publication."estimatorImplementationVersion" AS "estimatorImplementationVersion",
      count(DISTINCT pool.id)::integer AS "poolItems",
      count(DISTINCT attempt.id)::integer AS attempts,
      count(DISTINCT publication."empiricalValidationId")::integer AS validations,
      publication."sealedAt" IS NOT NULL AS sealed
    FROM "PracticeQuizAdaptivePublication" publication
    LEFT JOIN "PracticeQuizAdaptivePoolItem" pool ON pool."publicationId" = publication.id
    LEFT JOIN "AdaptivePracticeQuizAttempt" attempt ON attempt."publicationId" = publication.id
    GROUP BY publication.id
  `)
  assert.deepEqual(publication.rows, [
    {
      measurementVersion: 'IRT_V1',
      estimatorImplementationVersion: 'irt-v1-legacy',
      poolItems: 2,
      attempts: 4,
      validations: 0,
      sealed: true,
    },
  ])

  const snapshotShapes = await client.query<{
    cuts: string
    weights: string
    evidence: string
    caps: string
    diagnostics: string
    fitStatus: string
    difStatus: string
    driftStatus: string
  }>(`
    SELECT
      jsonb_typeof(publication."cutScoreSnapshot") AS cuts,
      jsonb_typeof(publication."hierarchicalWeightSnapshot") AS weights,
      jsonb_typeof(publication."evidenceMinimumSnapshot") AS evidence,
      jsonb_typeof(publication."questionCapSnapshot") AS caps,
      jsonb_typeof(calibration.diagnostics) AS diagnostics,
      calibration.diagnostics->>'fitStatus' AS "fitStatus",
      calibration.diagnostics->>'difStatus' AS "difStatus",
      calibration.diagnostics->>'driftStatus' AS "driftStatus"
    FROM "PracticeQuizAdaptivePublication" publication
    CROSS JOIN LATERAL (
      SELECT diagnostics FROM "AdaptiveItemCalibration" ORDER BY id LIMIT 1
    ) calibration
    WHERE publication.version = 1
  `)
  assert.deepEqual(snapshotShapes.rows, [
    {
      cuts: 'array',
      weights: 'array',
      evidence: 'object',
      caps: 'object',
      diagnostics: 'object',
      fitStatus: 'WARN',
      difStatus: 'WARN',
      driftStatus: 'WARN',
    },
  ])

  const calibrations = await client.query<{
    status: string
    guessing: number
    responseCount: number
    participantCount: number
    elementVersion: number
  }>(`
    SELECT
      status::text,
      guessing,
      "responseCount" AS "responseCount",
      "participantCount" AS "participantCount",
      "elementVersion" AS "elementVersion"
    FROM "AdaptiveItemCalibration"
    ORDER BY "assignmentId", "elementVersion"
  `)
  assert.deepEqual(calibrations.rows, [
    {
      status: 'PROVISIONAL',
      guessing: 0.5,
      responseCount: 0,
      participantCount: 0,
      elementVersion: 1,
    },
    {
      status: 'PROVISIONAL',
      guessing: 0.5,
      responseCount: 0,
      participantCount: 0,
      elementVersion: 2,
    },
    {
      status: 'PROVISIONAL',
      guessing: 0.5,
      responseCount: 0,
      participantCount: 0,
      elementVersion: 1,
    },
  ])

  const attempts = await client.query<{
    measurementVersion: string
    estimatorImplementationVersion: string
    versioned: boolean
  }>(`
    SELECT
      "measurementVersion"::text AS "measurementVersion",
      "estimatorImplementationVersion" AS "estimatorImplementationVersion",
      "publicationId" IS NOT NULL AND "scaleVersionId" IS NOT NULL AS versioned
    FROM "AdaptivePracticeQuizAttempt"
    ORDER BY id
  `)
  assert.equal(attempts.rowCount, 4)
  assert(
    attempts.rows.every(
      ({ measurementVersion, estimatorImplementationVersion, versioned }) =>
        measurementVersion === 'IRT_V1' &&
        estimatorImplementationVersion === 'irt-v1-legacy' &&
        versioned
    )
  )

  const responseIdentity = await client.query<{ matches: boolean }>(`
    SELECT bool_and(response."publicationId" = attempt."publicationId") AS matches
    FROM "AdaptivePracticeQuizResponse" response
    JOIN "AdaptivePracticeQuizAttempt" attempt ON attempt.id = response."attemptId"
  `)
  assert.equal(responseIdentity.rows[0]?.matches, true)

  const expectedConstraints = [
    'aic_parameters_check',
    'apqcs_aggregate_schema_check',
    'apqev_evidence_check',
    'apqie_counts_check',
    'apqr_design_check',
    'ctsv_numeric_check',
    'pqap_lifecycle_timestamps_check',
    'pqap_policy_check',
    'pqapi_snapshot_check',
  ]
  const constraints = await client.query<{
    conname: string
    convalidated: boolean
  }>(
    `
      SELECT conname, convalidated
      FROM pg_constraint
      WHERE conname = ANY($1::text[])
      ORDER BY conname
    `,
    [expectedConstraints]
  )
  assert.deepEqual(
    constraints.rows,
    expectedConstraints.sort().map((conname) => ({
      conname,
      convalidated: true,
    }))
  )

  await assert.rejects(
    client.query(`
      UPDATE "CompetenceTreeScaleVersion"
      SET "priorMean" = 'NaN'::double precision
      WHERE "treeId" = '91000000-0000-4000-8000-000000000003'
    `),
    (error: DatabaseError) => error.code === '23514'
  )

  await assert.rejects(
    client.query(`
      INSERT INTO "CompetenceTreeScaleApproval" (
        id, "treeId", "scaleVersionId", method, "methodVersion", "panelSize",
        "standardSettingDate", "cutRationale", "artifactChecksum", "artifactKey",
        decision, "submittedById", "reviewerId", "reviewedAt"
      )
      SELECT
        '92000000-0000-4000-8000-000000000010', "treeId", id, 'bookmark', '1', 3,
        CURRENT_TIMESTAMP, '{}'::jsonb, 'checksum', 'private/key', 'APPROVED',
        "createdById", "createdById", CURRENT_TIMESTAMP
      FROM "CompetenceTreeScaleVersion"
      WHERE "treeId" = '91000000-0000-4000-8000-000000000003'
    `),
    (error: DatabaseError) => error.code === 'P0001'
  )

  await assert.rejects(
    client.query(`
      UPDATE "PracticeQuizAdaptivePoolItem"
      SET "elementName" = 'mutated historical snapshot'
      WHERE id = 9101
    `),
    (error: DatabaseError) => error.code === 'P0001'
  )

  await assert.rejects(
    client.query(`
      DELETE FROM "PracticeQuizAdaptivePoolItem"
      WHERE id = 9101
    `),
    (error: DatabaseError) => error.code === 'P0001'
  )

  await assert.rejects(
    client.query(`
      UPDATE "AdaptivePracticeQuizAttempt"
      SET "estimatorImplementationVersion" = 'mismatched-estimator'
      WHERE id = '91000000-0000-4000-8000-000000000007'
    `),
    (error: DatabaseError) => error.code === '23503'
  )

  await assert.rejects(
    client.query(`
      UPDATE "AdaptivePracticeQuizResponse"
      SET "itemRole" = 'FIELD_TEST'
      WHERE id = 9101
    `),
    (error: DatabaseError) => ['P0001', '23514'].includes(error.code)
  )

  await assert.rejects(
    client.query(`
      INSERT INTO "PracticeQuizAdaptivePublication" (
        id, version, "configId", "competenceTreeId", "scaleVersionId",
        "measurementVersion", "preset", "estimatorImplementationVersion",
        "classificationPolicyVersion", "calibrationPolicyVersion",
        "cutScoreSnapshot", "priorMean", "priorStandardDeviation", "gridMin",
        "gridMax", "gridStep", "classificationProbabilityThreshold",
        "hierarchicalWeightSnapshot", "evidenceMinimumSnapshot",
        "totalQuestionCap", "showTimer", "questionCapSnapshot", "candidateSetPolicyVersion",
        "randomizationPolicyVersion", "exposureCeiling", "overlapPolicyVersion",
        "retakePolicy", "retakeCooldownDays", "researchAllocationPolicy", "stoppingPolicyVersion",
        "rolloutPolicyVersion", "publishedById", "publishedAt", "sealedAt", "createdAt"
      )
      SELECT
        '92000000-0000-4000-8000-000000000019', 99, "configId",
        "competenceTreeId", "scaleVersionId", "measurementVersion", "preset",
        "estimatorImplementationVersion", "classificationPolicyVersion",
        "calibrationPolicyVersion", "cutScoreSnapshot", "priorMean",
        "priorStandardDeviation", "gridMin", "gridMax", "gridStep",
        "classificationProbabilityThreshold", "hierarchicalWeightSnapshot",
        "evidenceMinimumSnapshot", "totalQuestionCap", "showTimer", "questionCapSnapshot",
        "candidateSetPolicyVersion", "randomizationPolicyVersion",
        "exposureCeiling", "overlapPolicyVersion", "retakePolicy", "retakeCooldownDays",
        "researchAllocationPolicy", "stoppingPolicyVersion",
        "rolloutPolicyVersion", "publishedById", CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM "PracticeQuizAdaptivePublication"
      WHERE version = 1
      LIMIT 1
    `),
    (error: DatabaseError) => error.code === 'P0001'
  )

  await client.query(`
    UPDATE "PracticeQuizAdaptiveConfig"
    SET preset = 'RESEARCH'
    WHERE id = '91000000-0000-4000-8000-000000000005';

    UPDATE "AdaptiveItemCalibration"
    SET status = 'PILOT', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "assignmentId" = 9102 AND "elementVersion" = 1;

    INSERT INTO "PracticeQuizAdaptivePublication" (
      id, version, "configId", "competenceTreeId", "scaleVersionId",
      "measurementVersion", "preset", "estimatorImplementationVersion",
      "classificationPolicyVersion", "calibrationPolicyVersion",
      "cutScoreSnapshot", "priorMean", "priorStandardDeviation", "gridMin",
      "gridMax", "gridStep", "classificationProbabilityThreshold",
      "hierarchicalWeightSnapshot", "evidenceMinimumSnapshot",
      "totalQuestionCap", "showTimer", "questionCapSnapshot", "candidateSetPolicyVersion",
      "randomizationPolicyVersion", "exposureCeiling", "overlapPolicyVersion",
      "retakePolicy", "retakeCooldownDays", "researchAllocationPolicy", "stoppingPolicyVersion",
      "rolloutPolicyVersion", "publishedById", "publishedAt", "createdAt"
    )
    SELECT
      '92000000-0000-4000-8000-000000000020', 2, "configId",
      "competenceTreeId", "scaleVersionId", 'IRT_V2_EAP_GRID_1', 'RESEARCH',
      'eap-grid-test', 2, 2, "cutScoreSnapshot", "priorMean",
      "priorStandardDeviation", "gridMin", "gridMax", "gridStep", 0.8,
      "hierarchicalWeightSnapshot", "evidenceMinimumSnapshot",
      "totalQuestionCap", "showTimer", "questionCapSnapshot", 'candidate-test',
      'randomization-test', 1, 'overlap-test', "retakePolicy", "retakeCooldownDays",
      '{"anchorProbability":0,"fieldTestProbability":1,"collectionDesignVersion":"test"}'::jsonb,
      'stopping-test', 1, '91000000-0000-4000-8000-000000000001',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "PracticeQuizAdaptivePublication"
    WHERE version = 1;

    INSERT INTO "PracticeQuizAdaptivePoolItem" (
      "configId", "competenceTreeId", "publicationId", "scaleVersionId",
      "calibrationId", "sourceAssignmentId", "elementId", "elementVersion",
      "elementType", "elementName", "elementData", "leafNodeId", "nodePath",
      "nodeNamePath", "levelId", "levelLabel", "levelOrder", discrimination,
      difficulty, guessing, "measurementVersion", "calibrationVersion",
      "calibrationStatus", "itemModel", "modelImplementationVersion", role,
      "contributesToEstimate", "enablePercentInput"
    )
    SELECT
      pool."configId", pool."competenceTreeId",
      '92000000-0000-4000-8000-000000000020', pool."scaleVersionId",
      calibration.id, pool."sourceAssignmentId", pool."elementId",
      pool."elementVersion", pool."elementType", pool."elementName",
      pool."elementData", pool."leafNodeId", pool."nodePath",
      pool."nodeNamePath", pool."levelId", pool."levelLabel", pool."levelOrder",
      calibration.discrimination, calibration.difficulty, calibration.guessing,
      'IRT_V2_EAP_GRID_1', calibration.version, calibration.status,
      calibration.model, calibration."modelImplementationVersion", 'FIELD_TEST',
      false, pool."enablePercentInput"
    FROM "PracticeQuizAdaptivePoolItem" pool
    JOIN "AdaptiveItemCalibration" calibration
      ON calibration."assignmentId" = pool."sourceAssignmentId"
     AND calibration."elementVersion" = pool."elementVersion"
    WHERE pool.id = 9102;

    UPDATE "PracticeQuizAdaptivePublication"
    SET "supersededAt" = CURRENT_TIMESTAMP
    WHERE version = 1;

    UPDATE "PracticeQuizAdaptivePublication"
    SET "sealedAt" = CURRENT_TIMESTAMP
    WHERE id = '92000000-0000-4000-8000-000000000020';
  `)

  const fieldTestPool = await client.query<{
    role: string
    contributesToEstimate: boolean
    calibrationStatus: string
    sealed: boolean
  }>(`
    SELECT
      pool.role::text,
      pool."contributesToEstimate" AS "contributesToEstimate",
      pool."calibrationStatus"::text AS "calibrationStatus",
      publication."sealedAt" IS NOT NULL AS sealed
    FROM "PracticeQuizAdaptivePoolItem" pool
    JOIN "PracticeQuizAdaptivePublication" publication ON publication.id = pool."publicationId"
    WHERE pool."publicationId" = '92000000-0000-4000-8000-000000000020'
  `)
  assert.deepEqual(fieldTestPool.rows, [
    {
      role: 'FIELD_TEST',
      contributesToEstimate: false,
      calibrationStatus: 'PILOT',
      sealed: true,
    },
  ])

  await assert.rejects(
    client.query(`
      INSERT INTO "PracticeQuizAdaptivePoolItem" (
        "configId", "competenceTreeId", "publicationId", "scaleVersionId",
        "calibrationId", "sourceAssignmentId", "elementId", "elementVersion",
        "elementType", "elementName", "elementData", "leafNodeId", "nodePath",
        "nodeNamePath", "levelId", "levelLabel", "levelOrder", discrimination,
        difficulty, guessing, "measurementVersion", "calibrationVersion",
        "calibrationStatus", "itemModel", "modelImplementationVersion", role,
        "contributesToEstimate", "enablePercentInput"
      )
      SELECT
        "configId", "competenceTreeId", "publicationId", "scaleVersionId",
        "calibrationId", "sourceAssignmentId", "elementId", "elementVersion",
        "elementType", "elementName", "elementData", "leafNodeId", "nodePath",
        "nodeNamePath", "levelId", "levelLabel", "levelOrder", discrimination,
        difficulty, guessing, "measurementVersion", "calibrationVersion",
        "calibrationStatus", "itemModel", "modelImplementationVersion", role,
        "contributesToEstimate", "enablePercentInput"
      FROM "PracticeQuizAdaptivePoolItem"
      WHERE "publicationId" = '92000000-0000-4000-8000-000000000020'
      LIMIT 1
    `),
    (error: DatabaseError) => error.code === 'P0001'
  )

  await client.query(`
    INSERT INTO "CompetenceTreeScaleApproval" (
      id, "treeId", "scaleVersionId", method, "methodVersion", "panelSize",
      "standardSettingDate", "cutRationale", "artifactChecksum", "artifactKey",
      "submittedById"
    )
    SELECT
      '92000000-0000-4000-8000-000000000011', "treeId", id, 'bookmark', '1', 3,
      CURRENT_TIMESTAMP, '[{"scaleLevelOrder":0,"codes":["PANEL"]}]'::jsonb,
      'checksum', 'private/key', "createdById"
    FROM "CompetenceTreeScaleVersion"
    WHERE "treeId" = '91000000-0000-4000-8000-000000000003'
  `)
  await client.query(`
    UPDATE "CompetenceTreeScaleVersion"
    SET status = 'IN_REVIEW', "submittedForReviewAt" = CURRENT_TIMESTAMP
    WHERE "treeId" = '91000000-0000-4000-8000-000000000003'
  `)
  await assert.rejects(
    client.query(`
      UPDATE "CompetenceTreeScaleApproval"
      SET method = 'mutated'
      WHERE id = '92000000-0000-4000-8000-000000000011'
    `),
    (error: DatabaseError) => error.code === 'P0001'
  )

  await assert.rejects(
    client.query(`
      DELETE FROM "PracticeQuizAdaptiveConfig"
      WHERE id = '91000000-0000-4000-8000-000000000005'
    `),
    (error: DatabaseError) => error.code === '23503'
  )
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
