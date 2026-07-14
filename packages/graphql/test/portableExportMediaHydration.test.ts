import { ElementType } from '@klicker-uzh/prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { ImportExportErrorCode } from '../src/lib/importExportErrors.js'
import { MAX_IMPORT_EXPORT_MEDIA_BYTES } from '../src/lib/importExportPackageConfig.js'
import type { PortableExportPlan } from '../src/services/portableExportPlan.js'

type MediaMetadata = {
  bytes: number
  contentType: string
  filename: string
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
  createMetadata: (index: number) => MediaMetadata
) {
  return new Map(
    plan.mediaInventory.firstParty.map((candidate, index) => [
      candidate.href,
      createMetadata(index),
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
    parseKlickerMediaUrl: vi.fn(),
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

  it('omits 100 maximum-size SVG candidates after one metadata batch without downloading bodies', async () => {
    const plan = createPlan(100)
    const metadata = metadataForPlan(plan, (index) => ({
      bytes: MAX_IMPORT_EXPORT_MEDIA_BYTES,
      contentType: 'image/svg+xml',
      filename: `vector-${index + 1}.svg`,
    }))
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
      ctx
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

  it('omits metadata/body size and content-type mismatches while preserving candidate order', async () => {
    const plan = createPlan(3)
    const validBody = Buffer.from('good')
    const candidates = plan.mediaInventory.firstParty
    const adapters = await loadHydrationWithMocks({
      metadata: metadataForPlan(plan, (index) => ({
        bytes: 4,
        contentType: 'image/png',
        filename: `declared-${index + 1}.png`,
      })),
      download: vi.fn(async (href: string) => {
        if (href === candidates[0]!.href) {
          return {
            buffer: Buffer.from('wrong'),
            contentType: 'image/png',
            filename: 'body-1.png',
          }
        }
        if (href === candidates[1]!.href) {
          return {
            buffer: Buffer.alloc(4),
            contentType: 'image/jpeg',
            filename: 'body-2.jpg',
          }
        }
        return {
          buffer: validBody,
          contentType: 'image/png',
          filename: 'body-3.png',
        }
      }),
    })

    await expect(
      adapters.hydratePortableExportMediaOutcomes(plan, {} as ContextWithUser)
    ).resolves.toEqual([
      {
        storageIdentity: candidates[0]!.storageIdentity,
        status: 'OMITTED',
      },
      {
        storageIdentity: candidates[1]!.storageIdentity,
        status: 'OMITTED',
      },
      {
        storageIdentity: candidates[2]!.storageIdentity,
        status: 'INCLUDED',
        filename: 'declared-3.png',
        contentType: 'image/png',
        bytes: 4,
        data: validBody,
      },
    ])
    expect(adapters.download.mock.calls.map(([href]) => href)).toEqual(
      candidates.map(({ href }) => href)
    )
  })
})
