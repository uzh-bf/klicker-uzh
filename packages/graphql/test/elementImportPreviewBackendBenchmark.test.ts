import {
  ElementType,
  ImportExportPackageArtifactState,
  type PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { Redis } from 'ioredis'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import type { ContextWithUser } from '../src/lib/context.js'
import { MAX_IMPORT_EXPORT_PACKAGE_BYTES } from '../src/lib/importExportPackageConfig.js'
import { createZip } from '../src/lib/zip.js'
import {
  prepareElementImportPackageUpload,
  validateElementImportPackage,
} from '../src/services/elementImportExport.js'
import {
  readLocalImportExportPackageBlob,
  uploadPreparedElementImportPackage,
} from '../src/services/packageStorage.js'
import { initializePrisma } from './helpers.js'

const ELEMENT_COUNT = 100
const SHARED_POOL_ENTRY_COUNT = 2_000
const SELECTED_REFS_PER_ELEMENT = 50
const TOTAL_SELECTED_REF_COUNT = ELEMENT_COUNT * SELECTED_REFS_PER_ELEMENT
const TOTAL_ENTRY_COUNT = 5_000
const VALIDATION_RUNS = 5

const TEST_ENV_KEYS = [
  'ASSESSMENT_MODE',
  'IMPORT_EXPORT_ENABLED',
  'IMPORT_EXPORT_PACKAGE_STORAGE',
  'IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY',
  'IMPORT_EXPORT_TOKEN_SECRET',
  'LOCAL_IMPORT_EXPORT_PACKAGE_DIR',
] as const

type BenchmarkRun = {
  run: number
  durationMs: number
  responseBytes: number
  heapUsedBeforeBytes: number
  heapUsedAfterBytes: number
  additionalHeapBytes: number
  maxRssBytes: number
}

function createCollection(ref: string, entryCount: number) {
  return {
    ref,
    name: `Benchmark collection ${ref}`,
    description: '',
    entries: Array.from({ length: entryCount }, (_, index) => ({
      ref: `${ref}-entry-${index + 1}`,
      value: `${ref} value ${index + 1}`,
    })),
  }
}

function createMaximumPreviewPackage() {
  const answerCollections = [
    createCollection('collection-1', SHARED_POOL_ENTRY_COUNT),
    createCollection('collection-2', 2_000),
    createCollection('collection-3', 1_000),
  ]
  const selectedEntryRefs = answerCollections[0]!.entries
    .slice(0, SELECTED_REFS_PER_ELEMENT)
    .map(({ ref }) => ref)
  const elements = Array.from({ length: ELEMENT_COUNT }, (_, index) => ({
    ref: `selection-${index + 1}`,
    name: `Benchmark selection ${index + 1}`,
    content: `Select the applicable answers for benchmark item ${index + 1}.`,
    type: ElementType.SELECTION,
    options: {
      hasSampleSolution: true,
      numberOfInputs: 1,
    },
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
    answerCollectionRef: answerCollections[0]!.ref,
    answerCollectionItemRefs: selectedEntryRefs,
  }))
  const manifest = {
    type: 'klicker-element-package',
    version: 3,
    createdAt: '2026-07-13T00:00:00.000Z',
    elements: elements.map((element) => ({
      ref: element.ref,
      file: `elements/${element.ref}.json`,
      answerCollectionRef: element.answerCollectionRef,
    })),
    answerCollections: answerCollections.map((collection) => ({
      ref: collection.ref,
      file: `answer-collections/${collection.ref}.json`,
    })),
    media: [],
  }

  const buffer = createZip([
    { path: 'manifest.json', data: JSON.stringify(manifest) },
    ...answerCollections.map((collection) => ({
      path: `answer-collections/${collection.ref}.json`,
      data: JSON.stringify(collection),
    })),
    ...elements.map((element) => ({
      path: `elements/${element.ref}.json`,
      data: JSON.stringify(element),
    })),
  ])

  return { buffer, manifest }
}

function getOwnerRateLimitKeys(ownerId: string) {
  return [
    `rate-limit:import-export-package:upload:${ownerId}`,
    `rate-limit:import-export-package:validate:${ownerId}`,
  ]
}

function maxRssBytes() {
  // Node reports resourceUsage().maxRSS in KiB on the Linux CI/DevPod runtime.
  return process.resourceUsage().maxRSS * 1024
}

function collectGarbageIfExposed() {
  const gc = Reflect.get(globalThis, 'gc')
  if (typeof gc === 'function') gc()
}

function restoreEnvironment(
  originalEnvironment: Map<string, string | undefined>
) {
  for (const [key, value] of originalEnvironment) {
    if (typeof value === 'undefined') {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

async function cleanupBenchmarkResources({
  localPackageDir,
  ownerId,
  prisma,
  redis,
  originalEnvironment,
}: {
  localPackageDir: string | undefined
  ownerId: string
  prisma: PrismaClient | undefined
  redis: Redis | undefined
  originalEnvironment: Map<string, string | undefined>
}) {
  const cleanupErrors: unknown[] = []
  const capture = async (operation: () => Promise<unknown>) => {
    try {
      await operation()
    } catch (error) {
      cleanupErrors.push(error)
    }
  }

  if (redis) {
    await capture(async () => {
      await redis.del(...getOwnerRateLimitKeys(ownerId))
      const residues = await redis.exists(...getOwnerRateLimitKeys(ownerId))
      if (residues !== 0) {
        throw new Error('Benchmark rate-limit keys were not removed.')
      }
    })
  }

  if (prisma) {
    await capture(async () => {
      await prisma.importExportPackageArtifact.deleteMany({
        where: { ownerId },
      })
      await prisma.user.deleteMany({ where: { id: ownerId } })
      const [artifacts, users] = await Promise.all([
        prisma.importExportPackageArtifact.count({ where: { ownerId } }),
        prisma.user.count({ where: { id: ownerId } }),
      ])
      if (artifacts !== 0 || users !== 0) {
        throw new Error('Benchmark database rows were not removed.')
      }
    })
  }

  if (localPackageDir) {
    await capture(async () => {
      await rm(localPackageDir, { recursive: true, force: true })
    })
  }
  if (redis) {
    await capture(async () => {
      await redis.quit()
    })
  }
  if (prisma) {
    await capture(async () => {
      await prisma.$disconnect()
    })
  }
  restoreEnvironment(originalEnvironment)

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      'Failed to clean up element import preview benchmark resources.'
    )
  }
}

describe.sequential('real-backend maximum element import preview benchmark', () => {
  it('validates one 100-element/5,000-entry/5,000-selected-ref artifact five times and records resource evidence', async () => {
    const originalEnvironment = new Map(
      TEST_ENV_KEYS.map((key) => [key, process.env[key]])
    )
    const ownerId = randomUUID()
    let localPackageDir: string | undefined
    let prisma: PrismaClient | undefined
    let redis: Redis | undefined

    try {
      localPackageDir = await mkdtemp(
        path.join(tmpdir(), 'klicker-import-preview-benchmark-')
      )
      process.env.IMPORT_EXPORT_ENABLED = 'true'
      process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'false'
      process.env.IMPORT_EXPORT_PACKAGE_STORAGE = 'local'
      process.env.IMPORT_EXPORT_TOKEN_SECRET =
        'preview-benchmark-token-secret-with-sufficient-entropy'
      process.env.LOCAL_IMPORT_EXPORT_PACKAGE_DIR = localPackageDir
      delete process.env.ASSESSMENT_MODE

      const initialized = await initializePrisma()
      prisma = initialized.prisma
      redis = new Redis({
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
      })
      await prisma.user.create({
        data: {
          id: ownerId,
          email: `import-preview-benchmark-${ownerId}@example.invalid`,
          shortname: `preview-benchmark-${ownerId.slice(0, 12)}`,
        },
      })
      const ctx = {
        prisma,
        redisExec: redis,
        user: {
          sub: ownerId,
          role: UserRole.USER,
          scope: UserLoginScope.FULL_ACCESS,
          catalystInstitutional: false,
          catalystIndividual: false,
        },
      } as ContextWithUser
      await redis.del(...getOwnerRateLimitKeys(ownerId))

      const { buffer, manifest } = createMaximumPreviewPackage()
      expect(manifest).not.toHaveProperty('tags')
      expect(buffer.length).toBeLessThanOrEqual(MAX_IMPORT_EXPORT_PACKAGE_BYTES)
      const packageSha256 = createHash('sha256').update(buffer).digest('hex')

      const prepared = await prepareElementImportPackageUpload(
        {
          filename: 'maximum-import-preview-benchmark.zip',
          bytes: buffer.length,
        },
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

      const artifacts = await prisma.importExportPackageArtifact.findMany({
        where: { ownerId },
        select: {
          id: true,
          state: true,
          storageBlob: true,
          bytes: true,
          sha256: true,
        },
      })
      expect(artifacts).toEqual([
        {
          id: prepared.artifactId,
          state: ImportExportPackageArtifactState.READY,
          storageBlob: expect.any(String),
          bytes: buffer.length,
          sha256: packageSha256,
        },
      ])
      const stored = await readLocalImportExportPackageBlob(
        artifacts[0]!.storageBlob
      )
      expect(stored?.equals(buffer)).toBe(true)

      collectGarbageIfExposed()
      const baselineHeapUsedBytes = process.memoryUsage().heapUsed
      const baselineMaxRssBytes = maxRssBytes()
      const runs: BenchmarkRun[] = []

      for (let run = 1; run <= VALIDATION_RUNS; run += 1) {
        collectGarbageIfExposed()
        const heapUsedBeforeBytes = process.memoryUsage().heapUsed
        const startedAt = performance.now()
        const validation = await validateElementImportPackage(
          { artifactId: prepared.artifactId },
          ctx
        )
        const durationMs = performance.now() - startedAt

        expect(validation.errors).toEqual([])
        expect(validation.importToken).toEqual(expect.any(String))
        expect(validation.warnings).toEqual([
          'IMPORT_STATUS_NORMALIZED_TO_REVIEW',
        ])
        expect(validation.elements).toHaveLength(ELEMENT_COUNT)
        expect(validation.answerCollections).toHaveLength(3)
        expect(
          validation.answerCollections.reduce(
            (total, collection) => total + collection.entries.length,
            0
          )
        ).toBe(TOTAL_ENTRY_COUNT)
        expect(
          validation.elements.every(
            (element) =>
              !element.alreadyImported &&
              element.answerCollectionItemIds.length ===
                SELECTED_REFS_PER_ELEMENT &&
              element.answerCollectionItemIds[0] === 1 &&
              element.answerCollectionItemIds.at(-1) ===
                SELECTED_REFS_PER_ELEMENT
          )
        ).toBe(true)

        const responseBytes = Buffer.byteLength(
          JSON.stringify(validation),
          'utf8'
        )
        const heapUsedAfterBytes = process.memoryUsage().heapUsed
        const additionalHeapBytes = Math.max(
          0,
          heapUsedAfterBytes - heapUsedBeforeBytes
        )
        const runMetrics = {
          run,
          durationMs,
          responseBytes,
          heapUsedBeforeBytes,
          heapUsedAfterBytes,
          additionalHeapBytes,
          maxRssBytes: maxRssBytes(),
        }
        runs.push(runMetrics)
      }

      const finalHeapUsedBytes = process.memoryUsage().heapUsed
      const finalMaxRssBytes = maxRssBytes()
      const additionalHeapBytes = Math.max(
        0,
        finalHeapUsedBytes - baselineHeapUsedBytes
      )
      const additionalMaxRssBytes = Math.max(
        0,
        finalMaxRssBytes - baselineMaxRssBytes
      )
      const sortedDurations = runs
        .map(({ durationMs }) => durationMs)
        .sort((left, right) => left - right)
      const medianDurationMs = sortedDurations[Math.floor(runs.length / 2)]!
      const worstDurationMs = Math.max(...sortedDurations)
      const maximumPerRunAdditionalHeapBytes = Math.max(
        ...runs.map((run) => run.additionalHeapBytes)
      )

      console.info(
        '[ElementImportPreviewBackendBenchmark]',
        JSON.stringify({
          fixture: {
            elements: ELEMENT_COUNT,
            answerCollections: 3,
            entries: TOTAL_ENTRY_COUNT,
            sharedPoolEntries: SHARED_POOL_ENTRY_COUNT,
            selectedRefsPerElement: SELECTED_REFS_PER_ELEMENT,
            selectedRefs: TOTAL_SELECTED_REF_COUNT,
          },
          packageBytes: buffer.length,
          packageSha256,
          runs,
          medianDurationMs,
          worstDurationMs,
          maximumResponseBytes: Math.max(
            ...runs.map(({ responseBytes }) => responseBytes)
          ),
          memory: {
            baselineHeapUsedBytes,
            finalHeapUsedBytes,
            additionalHeapBytes,
            maximumPerRunAdditionalHeapBytes,
            baselineMaxRssBytes,
            finalMaxRssBytes,
            additionalMaxRssBytes,
            heapDefinition:
              'Positive heapUsed delta from the pre-validation baseline to response completion; per-run deltas include the live result and its serialized response but are not transient allocation peaks.',
            rssDefinition:
              'Positive delta in Linux process.resourceUsage().maxRSS high-water bytes from the focused-process pre-validation baseline through all five runs.',
          },
        })
      )
    } finally {
      await cleanupBenchmarkResources({
        localPackageDir,
        ownerId,
        prisma,
        redis,
        originalEnvironment,
      })
    }
  }, 60_000)
})
