import { ElementType } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_MEDIA_BYTES } from '../src/lib/importExportPackageConfig.js'
import type { PortableExportPlan } from '../src/services/portableExportPlan.js'

type MediaMetadata = {
  bytes: number
  contentType: string
  filename: string
  sha256: string
}

function createPlan(count: number): PortableExportPlan {
  const firstParty = Array.from({ length: count }, (_, index) => {
    const suffix = String(index + 1).padStart(3, '0')
    const href = `https://media.test/imported/media-${suffix}.png`
    return {
      storageIdentity: `owner\0imported/media-${suffix}.png`,
      href,
      aliases: [href],
    }
  })

  return {
    elements: [
      {
        sourceId: 1,
        answerCollectionId: null,
        manifest: {
          ref: 'element-1',
          file: 'elements/element-1.json',
        },
        content: {
          ref: 'element-1',
          name: 'Media hydration boundary',
          content: firstParty
            .map(({ href }, index) => `![media ${index + 1}](<${href}>)`)
            .join('\n'),
          type: ElementType.CONTENT,
          options: {},
          pointsMultiplier: 1,
          basePoints: false,
          explanation: null,
          answerCollectionRef: undefined,
          answerCollectionItemRefs: undefined,
        },
      },
    ],
    answerCollections: [],
    mediaInventory: { firstParty, external: [] },
  }
}

function metadataForPlan(
  plan: PortableExportPlan,
  createMetadata: (
    index: number
  ) => Omit<MediaMetadata, 'sha256'> & Partial<Pick<MediaMetadata, 'sha256'>>
) {
  return new Map(
    plan.mediaInventory.firstParty.map((candidate, index) => [
      candidate.href,
      { sha256: 'a'.repeat(64), ...createMetadata(index) },
    ])
  )
}

async function loadHydrationWithMocks({
  metadata,
  download,
}: {
  metadata: Map<string, MediaMetadata | null>
  download: ReturnType<typeof vi.fn>
}) {
  const getKlickerMediaFilesExportMetadata = vi.fn(async () => metadata)
  vi.doMock('../src/services/mediaStorage.js', () => ({
    downloadKlickerMediaFile: download,
    getKlickerMediaFilesExportMetadata,
    resolveKlickerMediaHref: vi.fn(),
  }))

  const { hydratePortableExportMediaOutcomes } = await import(
    '../src/services/portableExportMediaHydration.js'
  )
  return {
    download,
    getKlickerMediaFilesExportMetadata,
    hydratePortableExportMediaOutcomes,
  }
}

describe('portable export media hydration preflight', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('../src/services/mediaStorage.js')
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('omits 100 durably unclassified SVG candidates without downloading bodies', async () => {
    const plan = createPlan(100)
    const metadata = new Map(
      plan.mediaInventory.firstParty.map((candidate) => [candidate.href, null])
    )
    const adapters = await loadHydrationWithMocks({
      metadata,
      download: vi.fn(),
    })
    const ctx = {} as ContextWithUser

    await expect(
      adapters.hydratePortableExportMediaOutcomes(plan, ctx)
    ).resolves.toEqual(
      plan.mediaInventory.firstParty.map(({ storageIdentity }) => ({
        storageIdentity,
        status: 'OMITTED',
      }))
    )
    expect(adapters.getKlickerMediaFilesExportMetadata).toHaveBeenCalledOnce()
    expect(adapters.getKlickerMediaFilesExportMetadata).toHaveBeenCalledWith(
      plan.mediaInventory.firstParty.map(({ href }) => href),
      ctx,
      expect.any(Function)
    )
    expect(adapters.download).not.toHaveBeenCalled()
  })

  it('rejects an archive made impossible by declared eligible bytes before downloading any body', async () => {
    const plan = createPlan(2)
    const adapters = await loadHydrationWithMocks({
      metadata: metadataForPlan(plan, (index) => ({
        bytes: MAX_IMPORT_EXPORT_MEDIA_BYTES,
        contentType: 'image/png',
        filename: `image-${index + 1}.png`,
      })),
      download: vi.fn(),
    })

    await expect(
      adapters.hydratePortableExportMediaOutcomes(plan, {} as ContextWithUser)
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE,
    })
    expect(adapters.getKlickerMediaFilesExportMetadata).toHaveBeenCalledOnce()
    expect(adapters.download).not.toHaveBeenCalled()
  })

  it('fails closed when downloaded bytes differ from the persisted hash', async () => {
    const plan = createPlan(1)
    const validBody = Buffer.from('good')
    const adapters = await loadHydrationWithMocks({
      metadata: metadataForPlan(plan, (index) => ({
        bytes: 4,
        contentType: 'image/png',
        filename: `declared-${index + 1}.png`,
        sha256: createHash('sha256').update(validBody).digest('hex'),
      })),
      download: vi.fn(async () => ({
        buffer: Buffer.from('evil'),
        contentType: 'image/png',
        filename: 'body.png',
      })),
    })

    await expect(
      adapters.hydratePortableExportMediaOutcomes(plan, {} as ContextWithUser)
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.INFRASTRUCTURE_FAILURE,
    })
  })

  it('carries the persisted hash into a successfully hydrated outcome', async () => {
    const plan = createPlan(1)
    const body = Buffer.from('good')
    const sha256 = createHash('sha256').update(body).digest('hex')
    const candidate = plan.mediaInventory.firstParty[0]!
    const adapters = await loadHydrationWithMocks({
      metadata: metadataForPlan(plan, () => ({
        bytes: body.length,
        contentType: 'image/png',
        filename: 'declared.png',
        sha256,
      })),
      download: vi.fn(async () => ({
        buffer: body,
        contentType: 'image/png',
        filename: 'body.png',
      })),
    })

    await expect(
      adapters.hydratePortableExportMediaOutcomes(plan, {} as ContextWithUser)
    ).resolves.toEqual([
      {
        storageIdentity: candidate.storageIdentity,
        status: 'INCLUDED',
        filename: 'declared.png',
        contentType: 'image/png',
        bytes: body.length,
        sha256,
        data: body,
      },
    ])
  })
})
