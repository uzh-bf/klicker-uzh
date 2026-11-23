import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  createKalturaCatalog,
  isOlatNodeCategory,
  type KalturaCatalog,
} from '../src/services/kalturaCatalog.js'
import type { CatalogModuleSnapshot } from '../src/services/uzhCourseCatalog.js'
import { resolveVideoSource } from '../src/services/videoSourceApproval.js'
import { rankCategoryCandidates } from '../src/services/videoSourceApprovalCore.js'

// Synthetic ids, names and addresses only.
const HS26 = { piqYear: '2026', piqSession: '003' as const }
const d = (iso: string) => new Date(iso)
const unix = (iso: string) => Math.floor(d(iso).getTime() / 1000)

describe('rankCategoryCandidates', () => {
  it('sorts newest first and proposes the run with recordings this semester', () => {
    const ranked = rankCategoryCandidates(
      [
        {
          categoryId: '1',
          name: 'ctx-a-2000001',
          fullName: 'x>ctx-a-2000001',
          createdAt: d('2025-09-01T00:00:00Z'),
          entriesCount: 20,
          recordings: [{ name: 'Old', createdAt: d('2025-10-01T00:00:00Z') }],
        },
        {
          categoryId: '3',
          name: 'ctx-c-2000001',
          fullName: 'x>ctx-c-2000001',
          createdAt: d('2026-10-01T00:00:00Z'),
          entriesCount: 0,
          recordings: [],
        },
        {
          categoryId: '2',
          name: 'ctx-b-2000001',
          fullName: 'x>ctx-b-2000001',
          createdAt: d('2026-08-20T00:00:00Z'),
          entriesCount: 8,
          recordings: [
            { name: 'Week 1', createdAt: d('2026-09-15T00:00:00Z') },
            { name: 'Week 2', createdAt: d('2026-09-22T00:00:00Z') },
          ],
        },
      ],
      HS26
    )
    expect(ranked.map((c) => c.categoryId)).toEqual(['3', '2', '1'])
    expect(ranked.find((c) => c.recommended)?.categoryId).toBe('2')
    expect(ranked[1]?.latestRecordingName).toBe('Week 2')
    expect(ranked[1]?.recordingsInSemester).toBe(2)
  })

  it('falls back to a category created in the semester, else proposes none', () => {
    const empty = {
      name: 'ctx-2000001',
      fullName: 'ctx-2000001',
      entriesCount: 0,
      recordings: [],
    }
    expect(
      rankCategoryCandidates(
        [{ ...empty, categoryId: '9', createdAt: d('2026-09-01T00:00:00Z') }],
        HS26
      )[0]?.recommended
    ).toBe(true)
    expect(
      rankCategoryCandidates(
        [{ ...empty, categoryId: '9', createdAt: d('2024-09-01T00:00:00Z') }],
        HS26
      )[0]?.recommended
    ).toBe(false)
  })

  it('matches OLAT node categories by name suffix', () => {
    expect(isOlatNodeCategory('ctx-1-2000001', '2000001')).toBe(true)
    expect(isOlatNodeCategory('ctx-1-12000001', '2000001')).toBe(false)
  })
})

describe('createKalturaCatalog', () => {
  it('starts an app token session and lists categories and entries', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const responses: Record<string, unknown> = {
      'session/action/startWidgetSession': { ks: 'widget-ks' },
      'appToken/action/startSession': { ks: 'app-ks' },
      'category/action/list': {
        objects: [
          {
            id: 11,
            name: 'ctx-2000001',
            fullName: 'a>ctx-2000001',
            createdAt: unix('2026-08-01T00:00:00Z'),
            entriesCount: 4,
          },
          {
            id: 12,
            name: 'ctx-92000001',
            fullName: 'a>ctx-92000001',
            createdAt: unix('2026-08-01T00:00:00Z'),
            entriesCount: 1,
          },
        ],
      },
      'categoryEntry/action/list': {
        objects: [{ entryId: '0_a' }, { entryId: '0_b' }],
      },
      'baseEntry/action/list': {
        objects: [
          {
            id: '0_a',
            name: 'Lecture',
            mediaType: 1,
            status: 2,
            createdAt: unix('2026-09-01T00:00:00Z'),
          },
          {
            id: '0_b',
            name: 'Camera',
            mediaType: 1,
            status: 2,
            parentEntryId: '0_a',
            createdAt: unix('2026-09-01T00:00:00Z'),
          },
        ],
      },
    }
    const audited: Array<{ action: string; params: Record<string, unknown> }> =
      []
    const kaltura = createKalturaCatalog({
      beforeCall: async ({ service, action, params }) => {
        audited.push({ action: `${service}.${action}`, params })
      },
      serviceUrl: 'https://kaltura.example.org/',
      partnerId: '1',
      appTokenId: 'token-id',
      appToken: 'fake-app-token',
      fetch: async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) })
        const key = url.split('/api_v3/service/')[1] ?? ''
        return { ok: true, status: 200, json: async () => responses[key] }
      },
    })

    const categories = await kaltura.findCategoriesForOlatNode('2000001')
    expect(categories.map((c) => c.id)).toEqual(['11'])
    const entries = await kaltura.listRecentEntries('11', 10)
    expect(entries.map((e) => e.parentEntryId)).toEqual([null, '0_a'])

    const start = calls.find((c) =>
      c.url.endsWith('appToken/action/startSession')
    )
    expect(start?.body.tokenHash).toBe(
      createHash('sha256').update('widget-ksfake-app-token').digest('hex')
    )
    // One session serves all calls.
    expect(
      calls.filter((c) => c.url.includes('startWidgetSession'))
    ).toHaveLength(1)
    expect(calls.at(-1)?.body.ks).toBe('app-ks')
    // Every request is announced first, without session or token material.
    expect(audited.map((a) => a.action)).toEqual(
      calls.map((c) =>
        c.url.split('/api_v3/service/')[1]?.replace('/action/', '.')
      )
    )
    expect(JSON.stringify(audited)).not.toMatch(
      /app-ks|widget-ks|tokenHash|token-id/
    )
    expect(
      audited.find((a) => a.action === 'category.list')?.params
    ).toMatchObject({ filter: { freeText: '2000001' } })
  })

  it('reports missing credentials instead of calling Kaltura', async () => {
    const kaltura = createKalturaCatalog({
      appTokenId: '',
      appToken: '',
      fetch: async () => {
        throw new Error('must not be called')
      },
    })
    await expect(kaltura.findCategoriesForOlatNode('1')).rejects.toThrow(
      'not configured'
    )
  })
})

describe('resolveVideoSource', () => {
  const snapshot: CatalogModuleSnapshot = {
    catalogUrl: 'https://courses.uzh.ch/#/details/2026/003/SM/51000001',
    moduleId: '51000001',
    semester: HS26,
    semesterLabel: 'HS26',
    title: 'Synthetic Finance',
    shortName: 'SYN101',
    offeringOrganization: null,
    offerPattern: null,
    events: [],
    contacts: [
      {
        personId: 'p1',
        roles: ['RESPONSIBLE'],
        title: null,
        firstName: 'Ada',
        lastName: 'Example',
        email: 'ada@example.org',
        function: null,
        organization: null,
        eventIds: [],
      },
    ],
    warnings: [],
    retrievedAt: '2026-11-23T00:00:00Z',
  }
  const catalog = { getModuleContacts: async () => snapshot }
  const kaltura: KalturaCatalog = {
    getCategory: async (id) =>
      id === '100001'
        ? {
            id,
            name: 'Channel',
            fullName: 'a>Channel',
            createdAt: d('2026-08-01T00:00:00Z'),
            entriesCount: 3,
          }
        : null,
    findCategoriesForOlatNode: async () => [
      {
        id: '7',
        name: 'ctx-2000001',
        fullName: 'a>ctx-2000001',
        createdAt: d('2026-08-10T00:00:00Z'),
        entriesCount: 3,
      },
    ],
    listRecentEntries: async () => [
      {
        id: '0_a',
        name: 'Week 1',
        mediaType: 1,
        sourceType: '35',
        parentEntryId: null,
        status: 2,
        createdAt: d('2026-09-20T00:00:00Z'),
      },
      {
        id: '0_b',
        name: 'Camera',
        mediaType: 1,
        sourceType: null,
        parentEntryId: '0_a',
        status: 2,
        createdAt: d('2026-09-20T00:00:00Z'),
      },
    ],
  }
  const now = () => d('2026-11-23T10:00:00Z')
  // The audit dependency is faked, so the context is never used.
  const noCtx = {} as ContextWithUser
  const audited: Array<{ type: string; payload: Record<string, unknown> }> = []

  it('combines the VVZ module and the proposed category of an OLAT node', async () => {
    const result = await resolveVideoSource(
      {
        sourceKind: 'OLAT_NODE',
        sourceUrl:
          'https://lms.uzh.ch/auth/RepositoryEntry/1000001/CourseNode/2000001',
        catalogUrl: snapshot.catalogUrl,
      },
      noCtx,
      {
        catalog,
        kaltura,
        now,
        audit: async (type, payload) => {
          audited.push({ type, payload })
        },
      }
    )
    expect(audited.map((a) => a.type)).toEqual(['KALTURA_LOOKUP_REQUESTED'])
    expect(result.olatNodeId).toBe('2000001')
    expect(result.catalog?.recipients.map((r) => r.email)).toEqual([
      'ada@example.org',
    ])
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.recommended).toBe(true)
    expect(result.candidates[0]?.sampleRecordingNames).toEqual(['Week 1'])
    expect(result.kalturaError).toBeNull()
  })

  it('keeps the VVZ half when Kaltura fails, and reports an unknown channel', async () => {
    const failing: KalturaCatalog = {
      ...kaltura,
      getCategory: async () => null,
    }
    const result = await resolveVideoSource(
      {
        sourceKind: 'KALTURA_CHANNEL',
        sourceUrl:
          'https://uzh.mediaspace.cast.switch.ch/channel/Synthetic/100002',
        catalogUrl: snapshot.catalogUrl,
      },
      noCtx,
      { catalog, kaltura: failing, now, audit: async () => undefined }
    )
    expect(result.catalog?.title).toBe('Synthetic Finance')
    expect(result.candidates).toEqual([])
    expect(result.kalturaError).toContain('channel link')
  })
})
