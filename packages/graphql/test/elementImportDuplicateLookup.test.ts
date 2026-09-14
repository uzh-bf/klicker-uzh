import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION as IMPORT_EXPORT_FINGERPRINT_VERSION } from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS,
  MAX_IMPORT_EXPORT_ELEMENTS,
} from '../src/lib/importExportPackageConfig.js'
import { findImportPackageDuplicateMatchesByFingerprint } from '../src/services/elementImportExport.js'

const HIGH_FANOUT_ROWS = 1_000
const DELETED_PREFIX_ROWS = 1_000
const UNRELATED_PREFIX_ROWS = 20_000
const TEST_RUN_ID = randomUUID()
const ELEMENT_FINGERPRINT = 'a'.repeat(64)
const ANSWER_COLLECTION_FINGERPRINT = 'b'.repeat(64)
const SECOND_ELEMENT_FINGERPRINT = 'e'.repeat(64)
const SECOND_ANSWER_COLLECTION_FINGERPRINT = 'f'.repeat(64)

type ExplainNode = {
  'Node Type': string
  'Index Name'?: string
  'Actual Rows'?: number
  'Actual Loops'?: number
  'Actual Total Time'?: number
  'Rows Removed by Filter'?: number
  'Shared Hit Blocks'?: number
  'Shared Read Blocks'?: number
  Plans?: ExplainNode[]
}

type ExplainDocument = {
  Plan: ExplainNode
}

function flattenPlan(node: ExplainNode): ExplainNode[] {
  return [node, ...(node.Plans ?? []).flatMap(flattenPlan)]
}

function getPlanRoot(rows: Array<{ 'QUERY PLAN': unknown }>) {
  const document = rows[0]?.['QUERY PLAN']
  const parsed = typeof document === 'string' ? JSON.parse(document) : document
  const explain = Array.isArray(parsed)
    ? (parsed[0] as ExplainDocument | undefined)
    : (parsed as ExplainDocument | undefined)

  if (!explain?.Plan) throw new Error('PostgreSQL returned no EXPLAIN plan.')

  return explain.Plan
}

function expectBoundedIndexProbe(
  rows: Array<{ 'QUERY PLAN': unknown }>,
  expectedIndexName: string,
  expectedLoops: number
) {
  const nodes = flattenPlan(getPlanRoot(rows))
  const indexProbe = nodes.find(
    (node) => node['Index Name'] === expectedIndexName
  )

  expect(
    indexProbe,
    JSON.stringify(
      nodes.map((node) => ({
        nodeType: node['Node Type'],
        indexName: node['Index Name'],
        actualRows: node['Actual Rows'],
        actualLoops: node['Actual Loops'],
      }))
    )
  ).toBeDefined()
  expect(indexProbe?.['Actual Rows']).toBe(1)
  expect(indexProbe?.['Actual Loops']).toBe(expectedLoops)
  expect(indexProbe?.['Rows Removed by Filter'] ?? 0).toBe(0)
  expect(nodes.some((node) => node['Node Type'] === 'Sort')).toBe(false)

  return indexProbe!
}

it('rejects raw duplicate candidates before they exceed package bounds', async () => {
  const ctx = {
    prisma,
    user: {
      sub: randomUUID(),
      role: UserRole.USER,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  }

  await expect(
    findImportPackageDuplicateMatchesByFingerprint(
      {
        elementFingerprints: Array.from(
          { length: MAX_IMPORT_EXPORT_ELEMENTS + 1 },
          () => ELEMENT_FINGERPRINT
        ),
        answerCollectionFingerprints: [],
      },
      ctx
    )
  ).rejects.toThrow('Duplicate-match candidate count exceeds package limits.')
  await expect(
    findImportPackageDuplicateMatchesByFingerprint(
      {
        elementFingerprints: [],
        answerCollectionFingerprints: Array.from(
          { length: MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS + 1 },
          () => ANSWER_COLLECTION_FINGERPRINT
        ),
      },
      ctx
    )
  ).rejects.toThrow('Duplicate-match candidate count exceeds package limits.')
})

describe.sequential('bounded import duplicate lookup', () => {
  let ownerId: string
  let noiseOwnerId: string
  let expectedElementId: number
  let expectedAnswerCollectionId: number
  let expectedSecondElementId: number
  let expectedSecondAnswerCollectionId: number

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: {
        email: `duplicate-lookup-${TEST_RUN_ID}@example.invalid`,
        shortname: `duplicate-lookup-${TEST_RUN_ID}`,
      },
    })
    ownerId = owner.id

    const noiseOwner = await prisma.user.create({
      data: {
        email: `duplicate-lookup-noise-${TEST_RUN_ID}@example.invalid`,
        shortname: `duplicate-lookup-noise-${TEST_RUN_ID}`,
      },
    })
    noiseOwnerId = noiseOwner.id

    // Put a large unrelated prefix before the target rows. A primary-key scan
    // can otherwise look artificially cheap in an empty test database because
    // the first matching target id is also the first table id.
    await prisma.$executeRaw`
      INSERT INTO "Element" (
        "type",
        "name",
        "content",
        "options",
        "basePoints",
        "ownerId",
        "importFingerprint",
        "importFingerprintVersion",
        "updatedAt"
      )
      SELECT
        'CONTENT'::"ElementType",
        'Unrelated element ' || candidate::text,
        'Unrelated content',
        '{}'::jsonb,
        false,
        ${noiseOwnerId}::uuid,
        ${'c'.repeat(64)},
        ${IMPORT_EXPORT_FINGERPRINT_VERSION},
        CURRENT_TIMESTAMP
      FROM generate_series(1, ${UNRELATED_PREFIX_ROWS}::integer) AS candidate
    `
    await prisma.$executeRaw`
      INSERT INTO "AnswerCollection" (
        "name",
        "description",
        "ownerId",
        "importFingerprint",
        "importFingerprintVersion",
        "updatedAt"
      )
      SELECT
        'Unrelated collection ' || candidate::text,
        'Unrelated content',
        ${noiseOwnerId}::uuid,
        ${'d'.repeat(64)},
        ${IMPORT_EXPORT_FINGERPRINT_VERSION},
        CURRENT_TIMESTAMP
      FROM generate_series(1, ${UNRELATED_PREFIX_ROWS}::integer) AS candidate
    `

    await prisma.element.create({
      data: {
        type: ElementType.CONTENT,
        name: 'Deleted lower-id duplicate',
        content: 'Deleted duplicate',
        options: {},
        basePoints: false,
        isDeleted: true,
        importFingerprint: ELEMENT_FINGERPRINT,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        ownerId,
      },
    })
    await prisma.$executeRaw`
      INSERT INTO "Element" (
        "type",
        "name",
        "content",
        "options",
        "basePoints",
        "isDeleted",
        "ownerId",
        "importFingerprint",
        "importFingerprintVersion",
        "updatedAt"
      )
      SELECT
        'CONTENT'::"ElementType",
        'Deleted prefix element ' || candidate::text,
        'Deleted duplicate',
        '{}'::jsonb,
        false,
        true,
        ${ownerId}::uuid,
        ${ELEMENT_FINGERPRINT},
        ${IMPORT_EXPORT_FINGERPRINT_VERSION},
        CURRENT_TIMESTAMP
      FROM generate_series(1, ${DELETED_PREFIX_ROWS}::integer) AS candidate
    `
    const expectedElement = await prisma.element.create({
      data: {
        type: ElementType.CONTENT,
        name: 'Lowest active element duplicate',
        content: 'Active duplicate',
        options: {},
        basePoints: false,
        importFingerprint: ELEMENT_FINGERPRINT,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        ownerId,
      },
    })
    expectedElementId = expectedElement.id

    await prisma.answerCollection.create({
      data: {
        name: 'Deleted lower-id duplicate',
        description: 'Deleted duplicate',
        isDeleted: true,
        importFingerprint: ANSWER_COLLECTION_FINGERPRINT,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        ownerId,
      },
    })
    await prisma.$executeRaw`
      INSERT INTO "AnswerCollection" (
        "name",
        "description",
        "isDeleted",
        "ownerId",
        "importFingerprint",
        "importFingerprintVersion",
        "updatedAt"
      )
      SELECT
        'Deleted prefix collection ' || candidate::text,
        'Deleted duplicate',
        true,
        ${ownerId}::uuid,
        ${ANSWER_COLLECTION_FINGERPRINT},
        ${IMPORT_EXPORT_FINGERPRINT_VERSION},
        CURRENT_TIMESTAMP
      FROM generate_series(1, ${DELETED_PREFIX_ROWS}::integer) AS candidate
    `
    const expectedAnswerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Lowest active collection duplicate',
        description: 'Active duplicate',
        importFingerprint: ANSWER_COLLECTION_FINGERPRINT,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        ownerId,
      },
    })
    expectedAnswerCollectionId = expectedAnswerCollection.id

    await prisma.$executeRaw`
      INSERT INTO "Element" (
        "type",
        "name",
        "content",
        "options",
        "basePoints",
        "ownerId",
        "importFingerprint",
        "importFingerprintVersion",
        "updatedAt"
      )
      SELECT
        'CONTENT'::"ElementType",
        'High-fanout element ' || candidate::text,
        'High-fanout duplicate',
        '{}'::jsonb,
        false,
        ${ownerId}::uuid,
        ${ELEMENT_FINGERPRINT},
        ${IMPORT_EXPORT_FINGERPRINT_VERSION},
        CURRENT_TIMESTAMP
      FROM generate_series(1, ${HIGH_FANOUT_ROWS}::integer) AS candidate
    `
    await prisma.$executeRaw`
      INSERT INTO "AnswerCollection" (
        "name",
        "description",
        "ownerId",
        "importFingerprint",
        "importFingerprintVersion",
        "updatedAt"
      )
      SELECT
        'High-fanout collection ' || candidate::text,
        'High-fanout duplicate',
        ${ownerId}::uuid,
        ${ANSWER_COLLECTION_FINGERPRINT},
        ${IMPORT_EXPORT_FINGERPRINT_VERSION},
        CURRENT_TIMESTAMP
      FROM generate_series(1, ${HIGH_FANOUT_ROWS}::integer) AS candidate
    `

    const secondElement = await prisma.element.create({
      data: {
        type: ElementType.CONTENT,
        name: 'Second element candidate',
        content: 'Second candidate',
        options: {},
        basePoints: false,
        importFingerprint: SECOND_ELEMENT_FINGERPRINT,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        ownerId,
      },
    })
    expectedSecondElementId = secondElement.id
    const secondAnswerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Second collection candidate',
        description: 'Second candidate',
        importFingerprint: SECOND_ANSWER_COLLECTION_FINGERPRINT,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
        ownerId,
      },
    })
    expectedSecondAnswerCollectionId = secondAnswerCollection.id

    await prisma.$executeRaw`ANALYZE "Element"`
    await prisma.$executeRaw`ANALYZE "AnswerCollection"`
  }, 30_000)

  afterAll(async () => {
    const ownerIds = [ownerId, noiseOwnerId].filter(Boolean)
    if (ownerIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ownerIds } } })
    }
    await prisma.$disconnect()
  })

  it('returns the lowest active id and uses one index-backed LIMIT probe per candidate', async () => {
    const matches = await findImportPackageDuplicateMatchesByFingerprint(
      {
        elementFingerprints: [
          ELEMENT_FINGERPRINT,
          SECOND_ELEMENT_FINGERPRINT,
          ELEMENT_FINGERPRINT,
        ],
        answerCollectionFingerprints: [
          ANSWER_COLLECTION_FINGERPRINT,
          SECOND_ANSWER_COLLECTION_FINGERPRINT,
          ANSWER_COLLECTION_FINGERPRINT,
        ],
      },
      {
        prisma,
        user: {
          sub: ownerId,
          role: UserRole.USER,
          scope: UserLoginScope.FULL_ACCESS,
          catalystInstitutional: false,
          catalystIndividual: false,
        },
      }
    )

    expect(matches.elementMatchByFingerprint?.get(ELEMENT_FINGERPRINT)).toEqual(
      {
        id: expectedElementId,
        name: 'Lowest active element duplicate',
      }
    )
    expect(
      matches.answerCollectionMatchByFingerprint?.get(
        ANSWER_COLLECTION_FINGERPRINT
      )
    ).toEqual({
      id: expectedAnswerCollectionId,
      name: 'Lowest active collection duplicate',
    })
    expect(
      matches.elementMatchByFingerprint?.get(SECOND_ELEMENT_FINGERPRINT)
    ).toEqual({
      id: expectedSecondElementId,
      name: 'Second element candidate',
    })
    expect(
      matches.answerCollectionMatchByFingerprint?.get(
        SECOND_ANSWER_COLLECTION_FINGERPRINT
      )
    ).toEqual({
      id: expectedSecondAnswerCollectionId,
      name: 'Second collection candidate',
    })

    const elementPlan = await prisma.$queryRaw<
      Array<{ 'QUERY PLAN': unknown }>
    >`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      WITH candidates("importFingerprint") AS (
        VALUES
          (${ELEMENT_FINGERPRINT}::text),
          (${SECOND_ELEMENT_FINGERPRINT}::text)
      )
      SELECT matched."id", matched."name", matched."importFingerprint"
      FROM candidates
      CROSS JOIN LATERAL (
        SELECT "id", "name", "importFingerprint"
        FROM "Element"
        WHERE ROW(
          "ownerId",
          "importFingerprintVersion",
          "importFingerprint",
          "isDeleted",
          "id"
        ) >= ROW(
          ${ownerId}::uuid,
          ${IMPORT_EXPORT_FINGERPRINT_VERSION}::integer,
          candidates."importFingerprint",
          false,
          '-2147483648'::integer
        )
          AND ROW(
            "ownerId",
            "importFingerprintVersion",
            "importFingerprint",
            "isDeleted",
            "id"
          ) < ROW(
            ${ownerId}::uuid,
            ${IMPORT_EXPORT_FINGERPRINT_VERSION}::integer,
            candidates."importFingerprint",
            true,
            '-2147483648'::integer
          )
        ORDER BY
          "ownerId",
          "importFingerprintVersion",
          "importFingerprint",
          "isDeleted",
          "id"
        LIMIT 1
      ) AS matched
      LIMIT 2
    `
    const answerCollectionPlan = await prisma.$queryRaw<
      Array<{ 'QUERY PLAN': unknown }>
    >`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      WITH candidates("importFingerprint") AS (
        VALUES
          (${ANSWER_COLLECTION_FINGERPRINT}::text),
          (${SECOND_ANSWER_COLLECTION_FINGERPRINT}::text)
      )
      SELECT matched."id", matched."name", matched."importFingerprint"
      FROM candidates
      CROSS JOIN LATERAL (
        SELECT "id", "name", "importFingerprint"
        FROM "AnswerCollection"
        WHERE ROW(
          "ownerId",
          "importFingerprintVersion",
          "importFingerprint",
          "isDeleted",
          "id"
        ) >= ROW(
          ${ownerId}::uuid,
          ${IMPORT_EXPORT_FINGERPRINT_VERSION}::integer,
          candidates."importFingerprint",
          false,
          '-2147483648'::integer
        )
          AND ROW(
            "ownerId",
            "importFingerprintVersion",
            "importFingerprint",
            "isDeleted",
            "id"
          ) < ROW(
            ${ownerId}::uuid,
            ${IMPORT_EXPORT_FINGERPRINT_VERSION}::integer,
            candidates."importFingerprint",
            true,
            '-2147483648'::integer
          )
        ORDER BY
          "ownerId",
          "importFingerprintVersion",
          "importFingerprint",
          "isDeleted",
          "id"
        LIMIT 1
      ) AS matched
      LIMIT 2
    `

    const elementIndexProbe = expectBoundedIndexProbe(
      elementPlan,
      'Element_owner_fpv_fp_id_idx',
      2
    )
    const answerCollectionIndexProbe = expectBoundedIndexProbe(
      answerCollectionPlan,
      'AnswerCollection_owner_fpv_fp_id_idx',
      2
    )
    console.info(
      '[ImportDuplicateLookupPlan]',
      JSON.stringify({
        duplicateRowsPerHighFanoutFingerprint:
          HIGH_FANOUT_ROWS + DELETED_PREFIX_ROWS + 2,
        deletedPrefixRowsPerModel: DELETED_PREFIX_ROWS + 1,
        uniqueCandidatesPerModel: 2,
        unrelatedPrefixRowsPerModel: UNRELATED_PREFIX_ROWS,
        element: {
          indexName: elementIndexProbe['Index Name'],
          actualRows: elementIndexProbe['Actual Rows'],
          actualLoops: elementIndexProbe['Actual Loops'],
          rowsRemovedByFilter: elementIndexProbe['Rows Removed by Filter'] ?? 0,
          sharedHitBlocks: elementIndexProbe['Shared Hit Blocks'] ?? 0,
          sharedReadBlocks: elementIndexProbe['Shared Read Blocks'] ?? 0,
          actualTotalTimeMs: elementIndexProbe['Actual Total Time'],
        },
        answerCollection: {
          indexName: answerCollectionIndexProbe['Index Name'],
          actualRows: answerCollectionIndexProbe['Actual Rows'],
          actualLoops: answerCollectionIndexProbe['Actual Loops'],
          rowsRemovedByFilter:
            answerCollectionIndexProbe['Rows Removed by Filter'] ?? 0,
          sharedHitBlocks: answerCollectionIndexProbe['Shared Hit Blocks'] ?? 0,
          sharedReadBlocks:
            answerCollectionIndexProbe['Shared Read Blocks'] ?? 0,
          actualTotalTimeMs: answerCollectionIndexProbe['Actual Total Time'],
        },
      })
    )
  })
})
