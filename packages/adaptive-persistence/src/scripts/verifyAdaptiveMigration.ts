import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from 'pg'
import { migrationQueries } from './migrationQueries.mjs'

const BOOTSTRAP = '20260929000000_adaptive_learning'

async function main() {
  const root = process.env.KLICKER_HOST_ROOT
  const url = process.env.DATABASE_URL
  if (!root || !url)
    throw new Error('KLICKER_HOST_ROOT and DATABASE_URL are required.')
  // This rehearsal creates and drops its own databases. Never target shared hosts.
  if (
    !['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(url).hostname)
  ) {
    throw new Error('Migration rehearsal requires disposable local PostgreSQL.')
  }
  const hostPath = join(root, 'packages/prisma/src/prisma/schema/migrations')
  const hostNames = (await readdir(hostPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const bootstrap = await readFile(
    join(
      root,
      'packages/adaptive-persistence/src/prisma/schema/migrations',
      BOOTSTRAP,
      'migration.sql'
    ),
    'utf8'
  )
  const admin = new Client({ connectionString: url })
  await admin.connect()
  try {
    for (const scenario of ['clean', 'populated', 'rollback'] as const) {
      const name = `adaptive_bootstrap_${scenario}_${process.pid}_${Date.now()}`
      await admin.query(`CREATE DATABASE "${name}"`)
      const target = new URL(url)
      target.pathname = `/${name}`
      const db = new Client({ connectionString: target.href })
      try {
        await db.connect()
        for (const migration of hostNames) {
          const sql = await readFile(
            join(hostPath, migration, 'migration.sql'),
            'utf8'
          )
          for (const statement of migrationQueries(sql))
            await db.query(statement)
        }
        if (scenario !== 'clean') await seedHostRows(db)
        const before = await hostRows(db)
        if (scenario === 'rollback') {
          assert.match(bootstrap, /COMMIT;\s*$/)
          await assert.rejects(
            db.query(bootstrap.replace(/COMMIT;\s*$/, 'SELECT 1 / 0; COMMIT;'))
          )
          await db.query('ROLLBACK')
          assert.equal(
            (await db.query(`SELECT to_regclass('"CompetenceTree"') AS value`))
              .rows[0].value,
            null
          )
          assert.equal(
            (
              await db.query(
                `SELECT count(*)::int AS n FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ObjectType' AND e.enumlabel='COMPETENCE_TREE'`
              )
            ).rows[0].n,
            0
          )
          assert.deepEqual(await hostRows(db), before)
        } else {
          await db.query(bootstrap)
          await verifyCleanReplay(db)
          assert.deepEqual(await hostRows(db), before)
          if (scenario === 'populated') {
            assert.deepEqual(
              (await db.query('SELECT mode::text FROM "PracticeQuiz"')).rows,
              [{ mode: 'STANDARD' }]
            )
            assert.deepEqual(
              (
                await db.query(
                  'SELECT "isAdaptiveLearningEnabled", "isAdaptiveLearningCalibrationEnabled" FROM "Course"'
                )
              ).rows,
              [
                {
                  isAdaptiveLearningEnabled: false,
                  isAdaptiveLearningCalibrationEnabled: false,
                },
              ]
            )
            await assert.rejects(
              db.query(`UPDATE "PracticeQuiz" SET mode='ADAPTIVE'`),
              /practice_quiz_adaptive_no_gamification_check/
            )
            await assert.rejects(
              db.query(
                `UPDATE "Element" SET "creationRequestFingerprint"='invalid'`
              ),
              /element_creation_request_identity_check/
            )
            await db.query(
              `UPDATE "PracticeQuiz" SET mode='ADAPTIVE', "pointsMultiplier"=0`
            )
          }
        }
        console.log(`Adaptive bootstrap ${scenario}: passed`)
      } finally {
        await db.end().catch(() => undefined)
        await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`)
      }
    }
  } finally {
    await admin.end()
  }
  console.log(
    `Adaptive migration rehearsal passed: ${hostNames.length} host migrations + 1 bootstrap.`
  )
}

async function seedHostRows(db: Client) {
  // Synthetic sentinels only; these are not copied from the local demo.
  await db.query(`
    INSERT INTO "User" (id,email,shortname,"updatedAt") VALUES
      ('10000000-0000-4000-8000-000000000001','migration@example.invalid','migration-test',CURRENT_TIMESTAMP);
    INSERT INTO "Course" (id,name,"displayName","ownerId","updatedAt","startDate","endDate","groupDeadlineDate","pinCode") VALUES
      ('10000000-0000-4000-8000-000000000002','existing-course','Existing course','10000000-0000-4000-8000-000000000001',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,123456);
    INSERT INTO "PracticeQuiz" (id,name,"displayName","ownerId","courseId","updatedAt") VALUES
      ('10000000-0000-4000-8000-000000000003','existing-quiz','Existing quiz','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',CURRENT_TIMESTAMP);
    INSERT INTO "Element" (name,content,options,type,"ownerId","updatedAt") VALUES
      ('existing-element','Synthetic sentinel','{}','SC','10000000-0000-4000-8000-000000000001',CURRENT_TIMESTAMP);
  `)
}

async function hostRows(db: Client) {
  const result: Record<string, unknown> = {}
  for (const [table, added] of [
    ['User', []],
    [
      'Course',
      ['isAdaptiveLearningEnabled', 'isAdaptiveLearningCalibrationEnabled'],
    ],
    ['PracticeQuiz', ['mode']],
    ['Element', ['creationRequestId', 'creationRequestFingerprint']],
  ] as const) {
    result[table] = (
      await db.query(
        `SELECT to_jsonb(t) - $1::text[] AS data FROM "${table}" t ORDER BY id`,
        [added]
      )
    ).rows
  }
  return result
}

async function verifyCleanReplay(client: Client) {
  const pilotConstraint = await client.query<{ convalidated: boolean }>(`
    SELECT convalidated FROM pg_constraint
    WHERE conname = 'pqap_placement_stopping_policy_check'
  `)
  assert.deepEqual(pilotConstraint.rows, [{ convalidated: true }])
  const rootGuard = await client.query<{ convalidated: boolean }>(`
    SELECT convalidated FROM pg_constraint
    WHERE conname = 'pqap_root_placement_leaf_caps_check'
  `)
  assert.deepEqual(rootGuard.rows, [{ convalidated: true }])
  const focusedPolicy = await client.query<{ definition: string }>(`
    SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conname = 'pqap_placement_stopping_policy_check'
  `)
  assert(
    focusedPolicy.rows[0]?.definition.includes(
      'IRT_V2_FOCUSED_ROOT_BALANCED_PLACEMENT_1'
    )
  )
  const mappedLeaves = await client.query<{ is_nullable: string }>(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'PracticeQuizAdaptivePoolItem'
      AND column_name = 'additionalLeafNodeIds'
  `)
  assert.deepEqual(mappedLeaves.rows, [{ is_nullable: 'NO' }])
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

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
