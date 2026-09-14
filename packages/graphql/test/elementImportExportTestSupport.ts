import {
  ElementStatus,
  ElementType,
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { graphql } from 'graphql/index.js'
import { schema } from '../src/index.js'
import { ElementDomainValidationError } from '../src/lib/elementDomain.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../src/lib/importExportErrors.js'
import { createZip, parseZip } from '../src/lib/zip.js'
import { prepareElementImportPackageUpload } from '../src/services/elementImportExport.js'
import { uploadPreparedElementImportPackage } from '../src/services/packageStorage.js'
import { testInitialization } from './helpers.js'

export function useImportExportTestEnvironment() {
  const originalImportExportEnabled = process.env.IMPORT_EXPORT_ENABLED
  const originalImportExportPrivatePreviewOnly =
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY
  const originalImportExportTokenSecret = process.env.IMPORT_EXPORT_TOKEN_SECRET
  const originalAssessmentMode = process.env.ASSESSMENT_MODE

  beforeAll(() => {
    process.env.IMPORT_EXPORT_ENABLED = 'true'
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'false'
    process.env.IMPORT_EXPORT_TOKEN_SECRET =
      'test-only-import-export-token-secret-000000000000'
    delete process.env.ASSESSMENT_MODE
  })

  afterAll(() => {
    if (typeof originalImportExportEnabled === 'undefined') {
      delete process.env.IMPORT_EXPORT_ENABLED
    } else {
      process.env.IMPORT_EXPORT_ENABLED = originalImportExportEnabled
    }

    if (typeof originalImportExportPrivatePreviewOnly === 'undefined') {
      delete process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY
    } else {
      process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY =
        originalImportExportPrivatePreviewOnly
    }

    if (typeof originalImportExportTokenSecret === 'undefined') {
      delete process.env.IMPORT_EXPORT_TOKEN_SECRET
    } else {
      process.env.IMPORT_EXPORT_TOKEN_SECRET = originalImportExportTokenSecret
    }

    if (typeof originalAssessmentMode === 'undefined') {
      delete process.env.ASSESSMENT_MODE
    } else {
      process.env.ASSESSMENT_MODE = originalAssessmentMode
    }
  })
}

export function importExportTestUser(sub: string) {
  return {
    sub,
    role: UserRole.USER,
    scope: UserLoginScope.FULL_ACCESS,
    catalystInstitutional: false,
    catalystIndividual: false,
  }
}

export async function uploadPreparedImportPackage(
  buffer: Buffer,
  ctx: Parameters<typeof prepareElementImportPackageUpload>[1]
) {
  const prepared = await prepareElementImportPackageUpload(
    { filename: 'package.zip', bytes: buffer.length },
    ctx
  )
  await uploadPreparedElementImportPackage(
    {
      artifactId: prepared.artifactId,
      capability: prepared.uploadCapability,
      contentLength: buffer.length,
      contentType: 'application/zip',
      stream: (async function* () {
        yield buffer
      })(),
    },
    ctx
  )
  return prepared
}

export function createMediaExportElement(href: string) {
  return {
    id: 987_654_321,
    name: 'Media export element',
    content: `Question with ![media](${href})`,
    options: {
      displayMode: 'LIST',
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      choices: [
        { ix: 0, value: 'First choice' },
        { ix: 1, value: 'Second choice' },
      ],
    },
    type: ElementType.SC,
    pointsMultiplier: 1,
    explanation: null,
    version: 1,
    status: ElementStatus.REVIEW,
    answerCollectionId: null,
    answerCollectionItems: [],
    basePoints: true,
  }
}

export function createMockExportSnapshot(
  elements: Array<Record<string, any>>,
  answerCollections: Array<Record<string, any>> = []
) {
  return {
    elements: elements.map((element) => ({
      updatedAt: new Date(0),
      exportPermission: PermissionLevel.OWNER,
      ...element,
      answerCollectionItems: (element.answerCollectionItems ?? []).map(
        (entry: Record<string, any>) => ({
          collectionId: element.answerCollectionId,
          updatedAt: new Date(0),
          ...entry,
        })
      ),
    })),
    answerCollections: answerCollections.map((collection) => ({
      updatedAt: new Date(0),
      exportPermission: PermissionLevel.OWNER,
      ...collection,
      entries: (collection.entries ?? []).map((entry: Record<string, any>) => ({
        updatedAt: new Date(0),
        ...entry,
      })),
    })),
    revision: {
      token: '0'.repeat(64),
      elementIds: elements.map(({ id }) => Number(id)),
      answerCollectionIds: answerCollections.map(({ id }) => Number(id)),
    },
  }
}

export function mockElementExportSnapshot(
  elements: Array<Record<string, any>>,
  answerCollections: Array<Record<string, any>> = []
) {
  const snapshot = createMockExportSnapshot(elements, answerCollections)
  vi.doMock('../src/services/elementExportSnapshot.js', async () => ({
    ...(await vi.importActual<
      typeof import('../src/services/elementExportSnapshot.js')
    >('../src/services/elementExportSnapshot.js')),
    loadElementExportSnapshot: vi.fn(async () => snapshot),
  }))
}

export function withMockExportSnapshotTransactions(
  mockPrisma: Record<string, any>
) {
  let lastPreflight:
    | { kind: 'element'; records: Array<Record<string, any>> }
    | { kind: 'answerCollection'; records: Array<Record<string, any>> }
    | undefined
  let transactionClient: Record<string, any>

  const element = mockPrisma.element
    ? new Proxy(mockPrisma.element, {
        get(target, property, receiver) {
          if (property !== 'findMany') {
            const value = Reflect.get(target, property, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          }
          return async (args: Record<string, any>) => {
            const records = await target.findMany(args)
            if (args.select?._count) {
              const preflight = records.map((record: Record<string, any>) => ({
                id: record.id,
                _count: {
                  answerCollectionItems:
                    record._count?.answerCollectionItems ??
                    record.answerCollectionItems?.length ??
                    0,
                },
              }))
              lastPreflight = { kind: 'element', records: preflight }
              return preflight
            }
            return records.map((record: Record<string, any>) => ({
              updatedAt: new Date(0),
              permissions: [{ permissionLevel: PermissionLevel.OWNER }],
              ...record,
              answerCollectionItems: (record.answerCollectionItems ?? []).map(
                (entry: Record<string, any>) => ({
                  collectionId: record.answerCollectionId,
                  updatedAt: new Date(0),
                  ...entry,
                })
              ),
            }))
          }
        },
      })
    : undefined
  const answerCollection = mockPrisma.answerCollection
    ? new Proxy(mockPrisma.answerCollection, {
        get(target, property, receiver) {
          if (property !== 'findMany') {
            const value = Reflect.get(target, property, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          }
          return async (args: Record<string, any>) => {
            const records = await target.findMany(args)
            if (args.select?._count) {
              const preflight = records.map((record: Record<string, any>) => ({
                id: record.id,
                _count: {
                  entries:
                    record._count?.entries ?? record.entries?.length ?? 0,
                },
              }))
              lastPreflight = {
                kind: 'answerCollection',
                records: preflight,
              }
              return preflight
            }
            return records.map((record: Record<string, any>) => ({
              updatedAt: new Date(0),
              permissions: [{ permissionLevel: PermissionLevel.OWNER }],
              ...record,
              entries: (record.entries ?? []).map(
                (entry: Record<string, any>) => ({
                  updatedAt: new Date(0),
                  ...entry,
                })
              ),
            }))
          }
        },
      })
    : undefined

  transactionClient = new Proxy(mockPrisma, {
    get(target, property, receiver) {
      if (property === '$transaction') {
        return async (
          callback: (tx: Record<string, any>) => Promise<unknown>
        ) => await callback(transactionClient)
      }
      if (property === '$queryRaw') {
        return async (...args: unknown[]) => {
          const template = args[0]
          const sql = Array.isArray(template) ? template.join('?') : ''
          if (sql.includes('maximumValueLength')) {
            return [{ maximumValueLength: 1, sourceBytes: 0n }]
          }
          if (lastPreflight?.kind === 'element') {
            return lastPreflight.records.map(({ id }) => ({
              id,
              nameLength: 1,
              contentLength: 1,
              explanationLength: 0,
              optionsTextBytes: 2,
              sourceBytes: 4n,
            }))
          }
          return (lastPreflight?.records ?? []).map(({ id }) => ({
            id,
            nameLength: 1,
            descriptionLength: 0,
            maximumEntryValueLength: 1,
            sourceBytes: 2n,
          }))
        }
      }
      if (property === 'element') return element
      if (property === 'answerCollection') return answerCollection
      const value = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

  return transactionClient
}

export function expectImportValidationError(
  operation: () => unknown,
  expectedCode: ImportExportErrorCode
) {
  let thrown: unknown
  try {
    operation()
  } catch (error) {
    thrown = error
  }

  const actualCode =
    thrown instanceof ImportExportDomainError
      ? thrown.code
      : thrown instanceof ElementDomainValidationError
        ? ImportExportErrorCode.INVALID_OPTIONS
        : null
  expect(actualCode).toBe(expectedCode)
}

export async function expectPublicImportExportError(
  operation: Promise<unknown>,
  expectedCode: ImportExportErrorCode,
  sensitiveText?: string
) {
  let thrown: unknown
  try {
    await operation
  } catch (error) {
    thrown = error
  }

  expect(thrown).toMatchObject({
    message: 'Import/export request failed.',
    extensions: { code: expectedCode },
  })
  if (sensitiveText) {
    expect(JSON.stringify(thrown)).not.toContain(sensitiveText)
  }

  return thrown
}

export function createAvailableImportExportRedis() {
  return {
    eval: vi.fn(async (script: string) =>
      script.includes('return {1, count + 1}') ? [1, 1] : 1
    ),
  }
}

export async function executeExportQuery({
  field,
  selection,
  elementIds,
  ctx,
}: {
  field: string
  selection: string
  elementIds: number[]
  ctx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
}) {
  return await graphql({
    schema,
    source: `query ExportPackage($elementIds: [Int!]!) {
      ${field}(elementIds: $elementIds) {
        ${selection}
      }
    }`,
    variableValues: { elementIds },
    contextValue: ctx,
  })
}

export async function clearPackageRateLimitKeys(
  ctx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
) {
  const keys = await ctx.redisExec.keys('rate-limit:import-export-package:*')
  if (keys.length > 0) {
    await ctx.redisExec.del(...keys)
  }
}

export async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>
) {
  const previousValues = new Map(
    Object.keys(overrides).map((key) => [key, process.env[key]])
  )

  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    return await fn()
  } finally {
    for (const [key, value] of previousValues) {
      if (typeof value === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

export async function seedPackageFixture(
  ctx: Awaited<ReturnType<typeof testInitialization>>['userOneCtx']
) {
  const answerCollection = await ctx.prisma.answerCollection.create({
    data: {
      name: 'Import export collection',
      description: 'Items used by portable element packages',
      ownerId: ctx.user.sub,
      entries: {
        create: [{ value: 'Alpha' }, { value: 'Beta' }, { value: 'Gamma' }],
      },
    },
    include: { entries: { orderBy: { value: 'asc' } } },
  })

  const [firstEntry, secondEntry] = answerCollection.entries
  if (!firstEntry || !secondEntry) {
    throw new Error('Test answer collection entries were not created.')
  }

  const singleChoice = await ctx.prisma.element.create({
    data: {
      type: ElementType.SC,
      name: 'Package SC',
      content: 'Single choice content',
      explanation: 'Single choice explanation',
      status: ElementStatus.READY,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [
          { ix: 0, value: 'Correct', correct: true },
          { ix: 1, value: 'Distractor', correct: false },
        ],
      },
      ownerId: ctx.user.sub,
    },
  })

  const selection = await ctx.prisma.element.create({
    data: {
      type: ElementType.SELECTION,
      name: 'Package Selection',
      content: 'Selection content',
      explanation: 'Selection explanation',
      status: ElementStatus.READY,
      options: {
        hasSampleSolution: true,
        numberOfInputs: 1,
      },
      ownerId: ctx.user.sub,
      answerCollectionId: answerCollection.id,
      answerCollectionItems: {
        connect: [{ id: firstEntry.id }],
      },
    },
  })

  const caseStudy = await ctx.prisma.element.create({
    data: {
      type: ElementType.CASE_STUDY,
      name: 'Package Case Study',
      content: 'Case study content',
      explanation: 'Case study explanation',
      status: ElementStatus.READY,
      options: {
        hasSampleSolution: true,
        criteria: [
          {
            id: 'criterion-1',
            name: 'Quality',
            order: 0,
            min: 0,
            max: 5,
            step: 1,
          },
        ],
        cases: [
          {
            id: 'case-1',
            title: 'Case 1',
            description: 'Case study description',
            order: 0,
            solutions: [
              {
                itemId: firstEntry.id,
                criteriaSolutions: [
                  { criterionId: 'criterion-1', min: 4, max: 5 },
                ],
              },
              {
                itemId: secondEntry.id,
                criteriaSolutions: [
                  { criterionId: 'criterion-1', min: 1, max: 2 },
                ],
              },
            ],
          },
        ],
      },
      ownerId: ctx.user.sub,
      answerCollectionId: answerCollection.id,
      answerCollectionItems: {
        connect: [{ id: firstEntry.id }, { id: secondEntry.id }],
      },
    },
  })

  await recomputeDerivedPermissions(
    { answerCollectionId: answerCollection.id },
    ctx.prisma
  )
  await Promise.all(
    [singleChoice, selection, caseStudy].map((element) =>
      recomputeDerivedPermissions({ elementId: element.id }, ctx.prisma)
    )
  )

  return {
    answerCollection,
    entries: answerCollection.entries,
    singleChoice,
    selection,
    caseStudy,
  }
}

export function createValidationPackage(
  manifestOverrides: Partial<Record<string, unknown>> = {},
  elementOverrides: Partial<Record<string, unknown>> = {},
  extraFiles: { path: string; data: Buffer | string }[] = []
) {
  const manifest = {
    type: 'klicker-element-package',
    version: 3,
    createdAt: new Date().toISOString(),
    elements: [{ ref: 'element-1', file: 'elements/element-1.json' }],
    answerCollections: [],
    media: [],
    ...manifestOverrides,
  }
  const element = {
    ref: 'element-1',
    name: 'Imported SC',
    content: 'Imported content',
    type: ElementType.SC,
    options: {
      displayMode: 'LIST',
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      choices: [
        { ix: 0, value: 'A' },
        { ix: 1, value: 'B' },
      ],
    },
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
    ...elementOverrides,
  }

  return createZip([
    { path: 'manifest.json', data: JSON.stringify(manifest) },
    { path: 'elements/element-1.json', data: JSON.stringify(element) },
    ...extraFiles,
  ])
}

export function createSelectionValidationPackage({
  manifestAnswerCollectionRef,
  elementAnswerCollectionRef,
  answerCollectionItemRefs,
  hasSampleSolution = true,
}: {
  manifestAnswerCollectionRef: string
  elementAnswerCollectionRef: string
  answerCollectionItemRefs: string[]
  hasSampleSolution?: boolean
}) {
  const manifest = {
    type: 'klicker-element-package',
    version: 3,
    createdAt: new Date().toISOString(),
    elements: [
      {
        ref: 'selection-1',
        file: 'elements/selection-1.json',
        answerCollectionRef: manifestAnswerCollectionRef,
      },
    ],
    answerCollections: [
      { ref: 'collection-1', file: 'answer-collections/collection-1.json' },
      { ref: 'collection-2', file: 'answer-collections/collection-2.json' },
    ],
    media: [],
  }
  const collectionOne = {
    ref: 'collection-1',
    name: 'Collection 1',
    description: '',
    entries: [{ ref: 'collection-1-entry-1', value: 'Alpha' }],
  }
  const collectionTwo = {
    ref: 'collection-2',
    name: 'Collection 2',
    description: '',
    entries: [{ ref: 'collection-2-entry-1', value: 'Beta' }],
  }
  const element = {
    ref: 'selection-1',
    name: 'Imported selection',
    content: 'Imported selection content',
    type: ElementType.SELECTION,
    options: {
      hasSampleSolution,
      numberOfInputs: 1,
    },
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
    answerCollectionRef: elementAnswerCollectionRef,
    answerCollectionItemRefs,
  }

  return createZip([
    { path: 'manifest.json', data: JSON.stringify(manifest) },
    {
      path: 'answer-collections/collection-1.json',
      data: JSON.stringify(collectionOne),
    },
    {
      path: 'answer-collections/collection-2.json',
      data: JSON.stringify(collectionTwo),
    },
    { path: 'elements/selection-1.json', data: JSON.stringify(element) },
  ])
}

export function createZipWithInvalidEntryPath() {
  const buffer = createZip([{ path: 'safe/entry-file.json', data: 'content' }])
  const from = Buffer.from('safe/entry-file.json')
  const to = Buffer.from('safe/../entry-x.json')
  if (from.length !== to.length) {
    throw new Error('ZIP test path replacement must keep the same length.')
  }

  const rewritten = Buffer.from(buffer)
  let offset = 0
  let replacements = 0

  while ((offset = rewritten.indexOf(from, offset)) !== -1) {
    to.copy(rewritten, offset)
    offset += to.length
    replacements++
  }

  expect(replacements).toBeGreaterThanOrEqual(2)
  return rewritten
}

export function createZipWithCentralLocalPathMismatch() {
  const buffer = createZip([{ path: 'safe/file-a.json', data: 'content' }])
  const from = Buffer.from('safe/file-a.json')
  const to = Buffer.from('safe/file-b.json')
  if (from.length !== to.length) {
    throw new Error('ZIP test path replacement must keep the same length.')
  }

  const rewritten = Buffer.from(buffer)
  const offset = rewritten.indexOf(from)
  expect(offset).toBeGreaterThan(-1)
  to.copy(rewritten, offset)
  return rewritten
}

export function createZipWithHugeDeclaredSize() {
  const buffer = createZip([{ path: 'small.txt', data: 'x' }])
  const rewritten = Buffer.from(buffer)
  const centralDirectoryOffset = rewritten.readUInt32LE(
    rewritten.length - 22 + 16
  )
  rewritten.writeUInt32LE(0xffff_ffff, centralDirectoryOffset + 24)
  return rewritten
}

export function createZipWithDataDescriptorFlags(buffer: Buffer) {
  const rewritten = Buffer.from(buffer)
  const entryCount = rewritten.readUInt16LE(rewritten.length - 22 + 10)
  let centralOffset = rewritten.readUInt32LE(rewritten.length - 22 + 16)

  for (let ix = 0; ix < entryCount; ix++) {
    const fileNameLength = rewritten.readUInt16LE(centralOffset + 28)
    const extraLength = rewritten.readUInt16LE(centralOffset + 30)
    const commentLength = rewritten.readUInt16LE(centralOffset + 32)
    const localHeaderOffset = rewritten.readUInt32LE(centralOffset + 42)

    rewritten.writeUInt16LE(0x0008, centralOffset + 8)
    rewritten.writeUInt16LE(0x0008, localHeaderOffset + 6)
    rewritten.writeUInt32LE(0, localHeaderOffset + 14)
    rewritten.writeUInt32LE(0, localHeaderOffset + 18)
    rewritten.writeUInt32LE(0, localHeaderOffset + 22)

    centralOffset += 46 + fileNameLength + extraLength + commentLength
  }

  return rewritten
}

export function createDeterministicBuffer(seed: number, length: number) {
  const buffer = Buffer.alloc(length)
  let value = seed >>> 0

  for (let ix = 0; ix < length; ix++) {
    value = (value * 1664525 + 1013904223) >>> 0
    buffer[ix] = value & 0xff
  }

  return buffer
}

export function rewritePackageJson(
  buffer: Buffer,
  rewrites: Record<string, (value: any) => any>
) {
  return createZip(
    parseZip(buffer).map((entry) => {
      const rewrite = rewrites[entry.path]

      return {
        path: entry.path,
        data: rewrite
          ? JSON.stringify(rewrite(JSON.parse(entry.data.toString('utf8'))))
          : entry.data,
      }
    })
  )
}
