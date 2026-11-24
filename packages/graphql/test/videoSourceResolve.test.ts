import { describe, expect, it } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  type CourseSourcesProvider,
  createCourseSourcesClient,
} from '../src/services/courseSources.js'
import { resolveVideoSource } from '../src/services/videoSourceApproval.js'

// Synthetic ids, names and addresses only.
const actor = { userId: 'admin-1', email: 'admin@example.org' }

type Call = {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

function fakeFetch(
  answer: (path: string) => { status: number; body: unknown },
  calls: Call[] = []
) {
  return async (
    url: string,
    init: { headers: Record<string, string>; body: string }
  ) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) })
    const { status, body } = answer(url.split('/course-sources/v1/')[1] ?? '')
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }
  }
}

const period = {
  label: 'HS26',
  start: '2026-08-01T00:00:00Z',
  end: '2027-02-01T00:00:00Z',
}
const directory = {
  canonicalUrl: 'https://directory.example.org/courses/51000001',
  title: 'Synthetic Finance',
  shortName: 'SYN101',
  recipients: [
    { name: 'Ada Example', email: 'ada@example.org', roles: ['RESPONSIBLE'] },
    { name: 'No Mail', email: '', roles: ['LECTURER'] },
  ],
  withoutEmail: ['No Mail'],
  warnings: [],
  snapshot: { moduleId: '51000001' },
}

describe('createCourseSourcesClient', () => {
  it('posts each call with the bearer token and parses the contract', async () => {
    const calls: Call[] = []
    const client = createCourseSourcesClient({
      url: 'https://sources.example.org/',
      token: 'fake-provider-credential',
      fetch: fakeFetch(
        (path) => ({
          status: 200,
          body:
            path === 'source-link'
              ? {
                  source: {
                    kind: 'KALTURA_CHANNEL',
                    externalRef: '100001',
                    fixedCollectionId: 100001,
                  },
                }
              : path === 'directory'
                ? { period, directory }
                : {
                    source: {
                      kind: 'OLAT_NODE',
                      externalRef: '2000001',
                      fixedCollectionId: null,
                    },
                    period,
                    directory: null,
                    directoryError: 'Directory unavailable',
                    collections: [
                      {
                        id: '7',
                        name: 'ctx-2000001',
                        fullName: 'a>ctx-2000001',
                        createdAt: '2026-08-10T00:00:00Z',
                        entriesCount: 3,
                        recordingsInPeriod: 2,
                        latestRecordingName: 'Week 2',
                        latestRecordingAt: '2026-09-22T00:00:00Z',
                        sampleRecordingNames: ['Week 2', 'Week 1'],
                        recommended: true,
                      },
                    ],
                    collectionsError: null,
                  },
        }),
        calls
      ),
    })

    expect(
      await client.sourceLink({ sourceUrl: 'https://media.example.org/c/1' })
    ).toEqual({
      kind: 'KALTURA_CHANNEL',
      externalRef: '100001',
      fixedCollectionId: '100001',
    })
    const dir = await client.directory({
      directoryUrl: directory.canonicalUrl,
    })
    expect(dir.period.end.toISOString()).toBe('2027-02-01T00:00:00.000Z')
    // Entries without an address are not recipients.
    expect(dir.directory.recipients.map((r) => r.email)).toEqual([
      'ada@example.org',
    ])
    const resolved = await client.resolve({
      sourceUrl: 'https://lms.example.org/node/2000001',
      directoryUrl: directory.canonicalUrl,
      period: 'HS26',
      actor,
    })
    expect(resolved.directory).toBeNull()
    expect(resolved.directoryError).toBe('Directory unavailable')
    expect(resolved.collections[0]?.latestRecordingAt?.toISOString()).toBe(
      '2026-09-22T00:00:00.000Z'
    )

    expect(calls.map((c) => c.url)).toEqual([
      'https://sources.example.org/course-sources/v1/source-link',
      'https://sources.example.org/course-sources/v1/directory',
      'https://sources.example.org/course-sources/v1/resolve',
    ])
    for (const call of calls) {
      expect(call.headers.Authorization).toBe('Bearer fake-provider-credential')
    }
    expect(calls[1]?.body).toEqual({
      directoryUrl: directory.canonicalUrl,
      period: null,
    })
    expect(calls[2]?.body.actor).toEqual(actor)
  })

  it('passes 422 messages through and keeps other failures generic', async () => {
    const client = (status: number, body: unknown) =>
      createCourseSourcesClient({
        url: 'https://sources.example.org',
        token: 'fake-provider-credential',
        fetch: fakeFetch(() => ({ status, body })),
      })
    await expect(
      client(422, {
        code: 'NOT_OFFERED',
        message: 'The course is not offered in HS26',
      }).directory({ directoryUrl: 'https://directory.example.org/x' })
    ).rejects.toMatchObject({
      message: 'The course is not offered in HS26',
      code: 'NOT_OFFERED',
      status: 422,
    })
    await expect(
      client(503, {
        code: 'UNAVAILABLE',
        message: 'upstream detail that stays inside',
      }).sourceLink({ sourceUrl: 'https://x.example.org' })
    ).rejects.toMatchObject({
      message: 'Course sources provider answered HTTP 503',
      code: 'UNAVAILABLE',
    })
    await expect(
      client(200, {
        period: { label: 'HS26', start: 'x', end: 'y' },
      }).directory({ directoryUrl: 'https://directory.example.org/x' })
    ).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' })
  })

  it('reports a missing provider instead of calling anything', async () => {
    const client = createCourseSourcesClient({
      url: '',
      token: '',
      fetch: async () => {
        throw new Error('must not be called')
      },
    })
    await expect(
      client.sourceLink({ sourceUrl: 'https://x.example.org' })
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
  })
})

describe('resolveVideoSource', () => {
  const ctx = {
    user: { sub: 'admin-1' },
    prisma: {
      user: {
        findUnique: async () => ({
          id: 'admin-1',
          email: 'admin@example.org',
          name: 'Synthetic admin',
          shortname: 'admin',
          accounts: [],
        }),
      },
    },
  } as unknown as ContextWithUser

  it('audits the lookup, identifies the admin and returns the preview', async () => {
    const audited: Array<{ type: string; payload: Record<string, unknown> }> =
      []
    let seenActor: unknown
    const provider: CourseSourcesProvider = {
      sourceLink: async () => {
        throw new Error('not used')
      },
      directory: async () => {
        throw new Error('not used')
      },
      resolve: async (args) => {
        seenActor = args.actor
        return {
          source: {
            kind: 'OLAT_NODE',
            externalRef: '2000001',
            fixedCollectionId: null,
          },
          period: {
            label: 'HS26',
            start: new Date(period.start),
            end: new Date(period.end),
          },
          directory: {
            ...directory,
            recipients: directory.recipients.slice(0, 1),
          },
          directoryError: null,
          collections: [],
          collectionsError: 'No collection found for this link',
        }
      },
    }
    const result = await resolveVideoSource(
      {
        sourceUrl: ' https://lms.example.org/node/2000001 ',
        directoryUrl: directory.canonicalUrl,
      },
      ctx,
      {
        provider,
        audit: async (type, payload) => {
          audited.push({ type, payload })
        },
      }
    )
    expect(audited).toEqual([
      {
        type: 'KALTURA_LOOKUP_REQUESTED',
        payload: {
          sourceUrl: 'https://lms.example.org/node/2000001',
          directoryUrl: directory.canonicalUrl,
          period: null,
        },
      },
    ])
    expect(seenActor).toEqual(actor)
    expect(result).toMatchObject({
      sourceKind: 'OLAT_NODE',
      externalRef: '2000001',
      periodLabel: 'HS26',
      collections: [],
      collectionsError: 'No collection found for this link',
    })
    expect(result.directory?.recipients.map((r) => r.email)).toEqual([
      'ada@example.org',
    ])
    // The snapshot holds personal data and stays out of the preview.
    expect(result.directory).not.toHaveProperty('snapshot')
  })

  it('needs a provider', async () => {
    await expect(
      resolveVideoSource(
        { sourceUrl: 'https://x.example.org', directoryUrl: 'https://y' },
        ctx,
        { provider: null }
      )
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
  })
})
