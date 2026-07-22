import { readFile } from 'node:fs/promises'
import {
  IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
  type VersionedDidacticFingerprint,
} from '../src/lib/importExportFingerprintCanonicalization.js'
import { bootstrapSeededImportExportFingerprints } from '../src/services/importExportFingerprintMaintenance.js'
import {
  createFingerprintPrisma,
  markFingerprintCurrent,
  type FakeFingerprintResource,
} from './importExportFingerprintTestSupport.js'

const mocks = vi.hoisted(() => ({
  answerCollections: [] as FakeFingerprintResource[],
  elements: [] as FakeFingerprintResource[],
}))

vi.mock('../src/services/importExportFingerprintPersistence.js', () => ({
  refreshAnswerCollectionDidacticFingerprint: vi.fn(async (id: number) => {
    markFingerprintCurrent(mocks.answerCollections, id)
    return updatedFingerprint(id)
  }),
  refreshElementDidacticFingerprint: vi.fn(async (id: number) => {
    markFingerprintCurrent(mocks.elements, id)
    return updatedFingerprint(id)
  }),
}))

function updatedFingerprint(id: number) {
  return {
    status: 'updated' as const,
    computed: {
      version: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
      fingerprint: `fingerprint-${id}`,
    } satisfies VersionedDidacticFingerprint,
  }
}

function staleResource(id: number): FakeFingerprintResource {
  return {
    id,
    importFingerprint: null,
    importFingerprintVersion: null,
    isDeleted: false,
  }
}

describe('post-seed import/export fingerprint bootstrap', () => {
  beforeEach(() => {
    mocks.answerCollections = Array.from({ length: 501 }, (_, index) =>
      staleResource(index + 1)
    )
    mocks.elements = Array.from({ length: 501 }, (_, index) =>
      staleResource(index + 1)
    )
  })

  it('drains more than one bounded stale-row repair pass', async () => {
    const { prisma } = createFingerprintPrisma({
      answerCollections: mocks.answerCollections,
      elements: mocks.elements,
    })

    await expect(
      bootstrapSeededImportExportFingerprints(prisma)
    ).resolves.toEqual({
      repairPasses: 2,
      processedAnswerCollections: 501,
      processedElements: 501,
    })
    expect(mocks.answerCollections[0]?.importFingerprint).toBe('fingerprint-1')
    expect(mocks.elements[500]?.importFingerprint).toBe('fingerprint-501')
  })

  it('fails closed at its bounded pass limit instead of scanning indefinitely', async () => {
    const { prisma } = createFingerprintPrisma({
      answerCollections: mocks.answerCollections,
      elements: mocks.elements,
    })

    await expect(
      bootstrapSeededImportExportFingerprints(prisma, { maxPasses: 1 })
    ).rejects.toThrow('guarded import/export rollout backfill')
    expect(mocks.answerCollections[499]?.importFingerprint).toBe(
      'fingerprint-500'
    )
    expect(mocks.answerCollections[500]?.importFingerprint).toBeNull()
  })

  it('keeps target selection inside each supported seed wrapper', async () => {
    const rootPackage = JSON.parse(
      await readFile(new URL('../../../package.json', import.meta.url), 'utf8')
    )
    const prismaDataPackage = JSON.parse(
      await readFile(
        new URL('../../prisma-data/package.json', import.meta.url),
        'utf8'
      )
    )
    const graphqlPackage = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8')
    )
    const postCreate = await readFile(
      new URL('../../../.devcontainer/post-create.sh', import.meta.url),
      'utf8'
    )
    const seedHelpers = await readFile(
      new URL('../../prisma-data/src/data/helpers.ts', import.meta.url),
      'utf8'
    )
    const seedBootstrap = await readFile(
      new URL(
        '../src/scripts/importExportSeedFingerprintBootstrap.ts',
        import.meta.url
      ),
      'utf8'
    )

    expect(rootPackage.scripts['prisma:setup:2']).toBe(
      'pnpm run --filter @klicker-uzh/prisma-data seed'
    )
    expect(postCreate).toContain(
      'pnpm --filter @klicker-uzh/prisma-data run seed:raw'
    )
    expect(prismaDataPackage.scripts['seed:test']).toBe(
      'run-s --continue-on-error --npm-path pnpm seed:test:raw seed:fingerprints'
    )
    expect(prismaDataPackage.scripts['seed:flashcards:with-fingerprints']).toBe(
      'run-s --continue-on-error --npm-path pnpm seed:flashcards:raw seed:fingerprints'
    )
    expect(prismaDataPackage.scripts.seed).toContain(
      '--env dev pnpm run seed:test'
    )
    expect(prismaDataPackage.scripts['seed:raw']).toBe(
      'ENV=development pnpm run seed:test'
    )
    expect(prismaDataPackage.scripts['seed:qa']).toContain(
      '--env stg pnpm run seed:test'
    )
    expect(prismaDataPackage.scripts['seed:flashcards']).toContain(
      '--env dev pnpm run seed:flashcards:with-fingerprints'
    )
    expect(prismaDataPackage.scripts['seed:prod:flashcards']).toContain(
      '--env prd pnpm run seed:flashcards:with-fingerprints'
    )
    expect(graphqlPackage.scripts['script:seed-fingerprint-bootstrap']).toBe(
      'tsx src/scripts/importExportSeedFingerprintBootstrap.ts'
    )
    expect(
      graphqlPackage.scripts['script:seed-fingerprint-bootstrap']
    ).not.toMatch(/--env|DATABASE_URL|IMPORT_EXPORT_DATABASE_TARGET/)
    expect(seedBootstrap).toContain('withAdvisoryLock')
    expect(seedBootstrap).toContain('assertCanPersist: assertLockHeld')
    expect(seedHelpers).toMatch(
      /prismaClient\.element\.update\([\s\S]*?importFingerprint: null,[\s\S]*?importFingerprintVersion: null,/
    )
  })
})
