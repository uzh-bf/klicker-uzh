import { createRequire } from 'node:module'
import {
  ElementStatus,
  ElementType,
  Prisma,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '@klicker-uzh/util'
import builder from '../src/builder.js'
import {
  ActivityArtifactRequestError,
  createActivityArtifactRuntime,
  createActivityArtifactRuntimeFromEnv,
  parseArtifactServiceUrl,
  parseCanonicalArtifactUrl,
  parsePublisherOrigin,
  sanitizeActivityArtifactPin,
  validateActivityArtifactExercise,
  validateArtifactRevisionPayload,
} from '../src/lib/activityArtifacts.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { ContentElement } from '../src/schema/element.js'
import { ContentElementData } from '../src/schema/elementData.js'
import {
  assertActivityArtifactPinsAccessible,
  getActivityArtifactForInstance,
  previewActivityArtifactByUrl,
  resolveContentArtifactPin,
  resolveStaffActivityArtifact,
} from '../src/services/activityArtifacts.js'
import {
  manipulateElement,
  updateElementInstances,
} from '../src/services/elements.js'
import {
  handlePublishScheduledMicroLearning,
  getMicroLearningData,
  publishMicroLearning,
} from '../src/services/microLearning.js'
import { getBookmarkedElementStacks } from '../src/services/participants.js'

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klicker-uzh/util')>()
  return {
    ...actual,
    recomputeDerivedPermissions: vi.fn().mockResolvedValue(undefined),
  }
})

const { graphql } = createRequire(import.meta.url)(
  'graphql'
) as typeof import('graphql')

const publisherOrigin = 'https://publisher.example'
const serviceUrl = 'http://artifact-pilot.default.svc.cluster.local:8080'
const artifactId = '5f0a8f0e-1e4a-4c1e-9d4f-0a1b2c3d4e5f'
const revisionId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const digest = 'a'.repeat(64)
const renderedDigest = 'b'.repeat(64)
const canonicalUrl = `${publisherOrigin}/a/${artifactId}`

const exercise = {
  title: 'Zero-coupon bond',
  years: 2,
  face: 1000,
  cashflows: [{ when: 'maturity', amount: 'face' }],
}

const revisionPayload = {
  artifactId,
  revisionId,
  digest,
  version: 3,
  title: 'Bond calculator',
  url: canonicalUrl,
  renderedDigest,
  exercise,
}

const contentArtifactPin = sanitizeActivityArtifactPin({
  ...revisionPayload,
  subject: 'lecturer-1',
})!

const contentElementWithArtifact = {
  id: 'content-1',
  elementId: 1,
  type: ElementType.CONTENT,
  name: 'Pinned content',
  content: '<p>Content</p>',
  pointsMultiplier: 1,
  options: { activityArtifact: contentArtifactPin },
}

builder.queryType({
  fields: (t) => ({
    contentElementWithArtifact: t.field({
      type: ContentElementData,
      resolve: () => contentElementWithArtifact,
    }),
    lecturerContentElementWithArtifact: t.field({
      type: ContentElement,
      resolve: () => contentElementWithArtifact as never,
    }),
  }),
})
const artifactMarkerSchema = builder.toSchema()

describe('activity artifact canonical links', () => {
  it('accepts the canonical author link for the configured origin', () => {
    expect(parseCanonicalArtifactUrl(canonicalUrl, publisherOrigin)).toEqual({
      artifactId,
    })
  })

  it.each([
    ['http://publisher.example/a/' + artifactId],
    ['https://other.example/a/' + artifactId],
    ['https://publisher.example/a/not-a-uuid'],
    ['https://publisher.example/a/' + artifactId + '/'],
    ['https://publisher.example/a/' + artifactId + '?token=x'],
    ['https://publisher.example/a/' + artifactId + '#fragment'],
    ['https://publisher.example/v1/artifacts/' + artifactId],
    ['https://user:pass@publisher.example/a/' + artifactId],
  ])('rejects the non-canonical link %s', (url) => {
    expect(parseCanonicalArtifactUrl(url, publisherOrigin)).toBeNull()
  })

  it('rejects publisher origins with a path or plain http', () => {
    expect(parsePublisherOrigin('http://publisher.example')).toBeNull()
    expect(parsePublisherOrigin('https://publisher.example/api')).toBeNull()
    expect(parsePublisherOrigin('https://publisher.example')).toBe(
      publisherOrigin
    )
  })

  it('keeps the internal service URL separate from the public origin', () => {
    expect(parseArtifactServiceUrl(serviceUrl)).toBe(serviceUrl)
    expect(parseArtifactServiceUrl('http://user:pass@service')).toBeNull()
    expect(parseArtifactServiceUrl(`${serviceUrl}/api`)).toBeNull()
    expect(parsePublisherOrigin(serviceUrl)).toBeNull()
  })
})

describe('activity artifact exercise contract', () => {
  it('accepts the bond exercise the publisher template renders', () => {
    expect(validateActivityArtifactExercise(exercise)).toEqual(exercise)
  })

  it('accepts numeric year-end coupons', () => {
    const coupon = {
      ...exercise,
      cashflows: [
        { when: 'year-end', amount: 40 },
        { when: 'maturity', amount: 'face' },
      ],
    }

    expect(validateActivityArtifactExercise(coupon)).toEqual(coupon)
  })

  it.each([
    ['extra field', { ...exercise, yield: 5 }],
    ['markup in title', { ...exercise, title: '<script>x</script>' }],
    ['control character in title', { ...exercise, title: 'Bond\u0000' }],
    [
      'Unicode control character in title',
      { ...exercise, title: 'Bond\u0085' },
    ],
    ['non-integer years', { ...exercise, years: 2.5 }],
    ['too many years', { ...exercise, years: 31 }],
    ['negative face', { ...exercise, face: -1 }],
    ['empty cashflows', { ...exercise, cashflows: [] }],
    [
      'unknown cashflow field',
      { ...exercise, cashflows: [{ when: 'maturity', amount: 'face', x: 1 }] },
    ],
    [
      'unknown timing',
      { ...exercise, cashflows: [{ when: 'start', amount: 'face' }] },
    ],
    [
      'negative amount',
      { ...exercise, cashflows: [{ when: 'year-end', amount: -5 }] },
    ],
  ])('rejects the unsupported exercise with %s', (_label, value) => {
    expect(validateActivityArtifactExercise(value)).toBeNull()
  })
})

describe('activity artifact revision responses', () => {
  it('normalizes a matching revision and drops publisher markup', () => {
    const result = validateArtifactRevisionPayload(revisionPayload, {
      publisherOrigin,
      artifactId,
      revisionId,
    })

    expect(result).toEqual({
      artifactId,
      revisionId,
      digest,
      version: 3,
      title: 'Bond calculator',
      url: canonicalUrl,
      renderedDigest,
      exercise,
    })
    expect(result).not.toHaveProperty('previewHtml')
  })

  it('rejects a response for a different artifact', () => {
    expect(
      validateArtifactRevisionPayload(
        {
          ...revisionPayload,
          artifactId: '11111111-1111-4111-8111-111111111111',
        },
        { publisherOrigin, artifactId }
      )
    ).toBeNull()
  })

  it('rejects a response for a different revision than the reviewed one', () => {
    expect(
      validateArtifactRevisionPayload(revisionPayload, {
        publisherOrigin,
        artifactId,
        revisionId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      })
    ).toBeNull()
  })

  it('rejects malformed digests and foreign link origins', () => {
    expect(
      validateArtifactRevisionPayload(
        { ...revisionPayload, digest: 'not-a-digest' },
        { publisherOrigin, artifactId }
      )
    ).toBeNull()
    expect(
      validateArtifactRevisionPayload(
        {
          ...revisionPayload,
          url: `https://other.example/a/${artifactId}`,
        },
        { publisherOrigin, artifactId }
      )
    ).toBeNull()
    expect(
      validateArtifactRevisionPayload(
        { ...revisionPayload, exercise: null },
        { publisherOrigin, artifactId }
      )
    ).toBeNull()
  })
})

describe('activity artifact pin storage', () => {
  it('keeps the mapped lecturer subject server-side', () => {
    const pin = sanitizeActivityArtifactPin({
      ...revisionPayload,
      digest,
      subject: 'lecturer-1',
    })

    expect(pin).toMatchObject({
      artifactId,
      revisionId,
      digest,
      version: 3,
      url: canonicalUrl,
      subject: 'lecturer-1',
      exercise,
    })
  })

  it('rejects a pin without a subject or with an unsupported exercise', () => {
    expect(
      sanitizeActivityArtifactPin({ ...revisionPayload, digest })
    ).toBeNull()
    expect(
      sanitizeActivityArtifactPin({
        ...revisionPayload,
        digest,
        subject: 'lecturer-1',
        exercise: { ...exercise, extra: true },
      })
    ).toBeNull()
  })
})

describe('activity artifact runtime requests', () => {
  const now = Date.parse('2026-11-26T10:00:00.000Z')

  function createFakeFetch(response: () => Response) {
    const calls: { url: string; init: RequestInit }[] = []
    const fetchImpl = (async (input: any, init: RequestInit) => {
      calls.push({ url: String(input), init })
      return response()
    }) as unknown as typeof fetch

    return { calls, fetchImpl }
  }

  it('reads the latest revision with the lecturer subject', async () => {
    const { calls, fetchImpl } = createFakeFetch(
      () => new Response(JSON.stringify(revisionPayload), { status: 200 })
    )
    const runtime = createActivityArtifactRuntime({
      publisherOrigin,
      serviceUrl,
      serviceToken: 'service-token',
      fetchImpl,
      now: () => now,
    })

    const revision = await runtime.getLatest({
      subject: 'lecturer-1',
      artifactId,
    })

    expect(revision.revisionId).toBe(revisionId)
    const call = calls[0]!
    expect(call.url).toBe(`${serviceUrl}/v1/artifacts/${artifactId}`)
    const headers = new Headers(call.init.headers)
    expect(headers.get('authorization')).toBe('Bearer service-token')
    expect(headers.get('x-artifact-subject')).toBe('lecturer-1')
    expect(headers.get('x-artifact-operation')).toBeNull()
  })

  it('sends a short-lived participant run claim for the pinned revision', async () => {
    const { calls, fetchImpl } = createFakeFetch(
      () => new Response(JSON.stringify(revisionPayload), { status: 200 })
    )
    const runtime = createActivityArtifactRuntime({
      publisherOrigin,
      serviceUrl,
      serviceToken: 'service-token',
      fetchImpl,
      now: () => now,
    })

    await runtime.getRevision({
      subject: 'participant-1',
      artifactId,
      revisionId,
      run: {
        participantId: 'participant-1',
        courseId: 'course-1',
        elementInstanceId: 42,
      },
    })

    const call = calls[0]!
    expect(call.url).toBe(
      `${serviceUrl}/v1/artifacts/${artifactId}/revisions/${revisionId}`
    )
    const headers = new Headers(call.init.headers)
    expect(headers.get('x-artifact-subject')).toBe('participant-1')
    expect(headers.get('x-artifact-operation')).toBe('run')
    expect(headers.get('x-artifact-course')).toBe('course-1')
    expect(headers.get('x-artifact-instance')).toBe('42')
    expect(headers.get('x-artifact-audience')).toBe('artifact-pilot')

    const expires = Number(headers.get('x-artifact-expires'))
    expect(expires - Math.floor(now / 1000)).toBeGreaterThan(0)
    expect(expires - Math.floor(now / 1000)).toBeLessThanOrEqual(30)
  })

  it('binds the published instance idempotently and reports a pin conflict', async () => {
    const bound = createFakeFetch(() => new Response(null, { status: 204 }))
    const boundRuntime = createActivityArtifactRuntime({
      publisherOrigin,
      serviceUrl,
      serviceToken: 'service-token',
      fetchImpl: bound.fetchImpl,
      now: () => now,
    })

    await expect(
      boundRuntime.assign({
        subject: 'lecturer-1',
        courseId: 'course-1',
        instanceId: '42',
        artifactId,
        revisionId,
      })
    ).resolves.toBe('bound')

    const assignmentCall = bound.calls[0]!
    expect(assignmentCall.url).toBe(`${serviceUrl}/v1/assignments`)
    expect(assignmentCall.init.method).toBe('POST')
    expect(JSON.parse(String(assignmentCall.init.body))).toEqual({
      courseId: 'course-1',
      instanceId: '42',
      artifactId,
      revisionId,
    })

    const conflict = createFakeFetch(() => new Response(null, { status: 409 }))
    const conflictRuntime = createActivityArtifactRuntime({
      publisherOrigin,
      serviceUrl,
      serviceToken: 'service-token',
      fetchImpl: conflict.fetchImpl,
      now: () => now,
    })

    await expect(
      conflictRuntime.assign({
        subject: 'lecturer-1',
        courseId: 'course-1',
        instanceId: '42',
        artifactId,
        revisionId,
      })
    ).resolves.toBe('conflict')
  })

  it('rejects malformed identifiers before contacting the publisher', async () => {
    const { calls, fetchImpl } = createFakeFetch(
      () => new Response(null, { status: 204 })
    )
    const runtime = createActivityArtifactRuntime({
      publisherOrigin,
      serviceUrl,
      serviceToken: 'service-token',
      fetchImpl,
    })

    await expect(
      runtime.getLatest({
        subject: 'lecturer-1',
        artifactId: '../assignments',
      })
    ).rejects.toThrow()
    await expect(
      runtime.assign({
        subject: 'lecturer-1',
        courseId: 'course-1',
        instanceId: '42',
        artifactId,
        revisionId: 'not-a-revision',
      })
    ).rejects.toThrow()

    expect(calls).toHaveLength(0)
  })

  it('rejects unexpected statuses and malformed payloads', async () => {
    const failing = createFakeFetch(() => new Response(null, { status: 500 }))
    const failingRuntime = createActivityArtifactRuntime({
      publisherOrigin,
      serviceUrl,
      serviceToken: 'service-token',
      fetchImpl: failing.fetchImpl,
    })

    await expect(
      failingRuntime.getLatest({ subject: 'lecturer-1', artifactId })
    ).rejects.toThrow()

    const mismatched = createFakeFetch(
      () =>
        new Response(JSON.stringify({ ...revisionPayload, digest: 'x' }), {
          status: 200,
        })
    )
    const mismatchedRuntime = createActivityArtifactRuntime({
      publisherOrigin,
      serviceUrl,
      serviceToken: 'service-token',
      fetchImpl: mismatched.fetchImpl,
    })

    await expect(
      mismatchedRuntime.getLatest({ subject: 'lecturer-1', artifactId })
    ).rejects.toThrow()
  })

  it('stops reading a streamed response once it exceeds the byte limit', async () => {
    let cancelled = false
    const oversizedChunk = new Uint8Array(512 * 1024 + 1)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([123]))
        controller.enqueue(oversizedChunk)
      },
      cancel() {
        cancelled = true
      },
    })
    const runtime = createActivityArtifactRuntime({
      publisherOrigin,
      serviceUrl,
      serviceToken: 'service-token',
      fetchImpl: (async () =>
        new Response(stream, { status: 200 })) as typeof fetch,
    })

    await expect(
      runtime.getLatest({ subject: 'lecturer-1', artifactId })
    ).rejects.toThrow('Artifact response exceeded limit')
    expect(cancelled).toBe(true)
  })

  it('rejects a run claim whose participant differs from its subject', async () => {
    const { calls, fetchImpl } = createFakeFetch(
      () => new Response(JSON.stringify(revisionPayload), { status: 200 })
    )
    const runtime = createActivityArtifactRuntime({
      publisherOrigin,
      serviceUrl,
      serviceToken: 'service-token',
      fetchImpl,
    })

    await expect(
      runtime.getRevision({
        subject: 'participant-1',
        artifactId,
        revisionId,
        run: {
          participantId: 'participant-2',
          courseId: 'course-1',
          elementInstanceId: 42,
        },
      })
    ).rejects.toThrow('Run participant does not match')
    expect(calls).toHaveLength(0)
  })
})

describe('activity artifact attach and upgrade', () => {
  const lecturerId = 'lecturer-1'

  const clientRevision = validateArtifactRevisionPayload(revisionPayload, {
    publisherOrigin,
    artifactId,
    revisionId,
  })!

  function lecturerRuntime() {
    return {
      publisherOrigin,
      serviceUrl,
      frameOrigin: publisherOrigin,
      getLatest: vi.fn(),
      getRevision: vi.fn(),
      assign: vi.fn(),
    }
  }

  function lecturerContext(
    runtime: ReturnType<typeof lecturerRuntime>,
    enabled = true
  ) {
    const isEnabled = vi.fn().mockReturnValue(enabled)

    return {
      isEnabled,
      ctx: {
        user: { sub: lecturerId, role: UserRole.USER },
        featureFlags: { isEnabled },
        betaPreference: {
          userId: lecturerId,
          value: Promise.resolve(true),
        },
        prisma: {},
        activityArtifactRuntime: runtime,
      } as unknown as ContextWithUser,
    }
  }

  it('previews the latest revision as the signed-in lecturer', async () => {
    const runtime = lecturerRuntime()
    runtime.getLatest.mockResolvedValue(clientRevision)
    const { ctx } = lecturerContext(runtime)

    await expect(
      previewActivityArtifactByUrl({ url: canonicalUrl }, ctx)
    ).resolves.toMatchObject({
      revisionId,
      frameUrl: publisherOrigin + '/frame',
    })
    expect(runtime.getLatest).toHaveBeenCalledWith({
      subject: lecturerId,
      artifactId,
    })
  })

  it.each([
    [403, 'FORBIDDEN'],
    [404, 'BAD_USER_INPUT'],
    [503, 'SERVICE_UNAVAILABLE'],
  ])('maps publisher status %i to %s', async (status, code) => {
    const runtime = lecturerRuntime()
    runtime.getLatest.mockRejectedValue(
      new ActivityArtifactRequestError('publisher failure', status)
    )
    const { ctx } = lecturerContext(runtime)

    const error: unknown = await previewActivityArtifactByUrl(
      { url: canonicalUrl },
      ctx
    ).catch((caught) => caught)
    expect(error).toMatchObject({ extensions: { code } })
    expect(
      (error as { extensions: Record<string, unknown> }).extensions
    ).not.toHaveProperty('activityArtifactPublish')
  })

  it('maps staff lookup transport failures with an actionable code', async () => {
    const runtime = lecturerRuntime()
    runtime.getLatest.mockRejectedValue(
      new ActivityArtifactRequestError('publisher unavailable', 503)
    )
    const { ctx } = lecturerContext(runtime)

    await expect(
      resolveStaffActivityArtifact({ artifactId }, ctx)
    ).rejects.toMatchObject({ extensions: { code: 'SERVICE_UNAVAILABLE' } })
  })

  it('re-resolves the exact reviewed revision on explicit confirmation', async () => {
    const runtime = lecturerRuntime()
    runtime.getRevision.mockResolvedValue(clientRevision)
    const { ctx } = lecturerContext(runtime)

    const pin = await resolveContentArtifactPin(
      { url: canonicalUrl, artifactId, revisionId },
      ctx
    )

    expect(pin).toMatchObject({
      artifactId,
      revisionId,
      subject: lecturerId,
    })
    expect(runtime.getRevision).toHaveBeenCalledWith({
      subject: lecturerId,
      artifactId,
      revisionId,
    })
    expect(runtime.getLatest).not.toHaveBeenCalled()
  })

  it('rejects a malformed revision id before calling the publisher', async () => {
    const runtime = lecturerRuntime()
    const { ctx } = lecturerContext(runtime)

    await expect(
      resolveContentArtifactPin(
        { url: canonicalUrl, artifactId, revisionId: 'not-a-revision' },
        ctx
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    expect(runtime.getRevision).not.toHaveBeenCalled()
  })

  it('denies direct confirmation while the feature flag is off', async () => {
    const runtime = lecturerRuntime()
    const { ctx } = lecturerContext(runtime, false)

    await expect(
      resolveContentArtifactPin(
        { url: canonicalUrl, artifactId, revisionId },
        ctx
      )
    ).rejects.toThrow('Forbidden')
    expect(runtime.getRevision).not.toHaveBeenCalled()
  })
})

describe('activity artifact participant access', () => {
  const participantId = 'participant-2'
  const microLearningId = 'microlearning-1'
  const courseId = 'course-1'
  const storedPin = sanitizeActivityArtifactPin({
    ...revisionPayload,
    subject: 'lecturer-1',
  })!
  const clientRevision = validateArtifactRevisionPayload(revisionPayload, {
    publisherOrigin,
    artifactId,
    revisionId,
  })!

  function participantContext({
    enabled = true,
    prisma = {},
    runtime = {},
  }: {
    enabled?: boolean
    prisma?: unknown
    runtime?: unknown
  } = {}) {
    const isEnabled = vi.fn().mockReturnValue(enabled)

    return {
      isEnabled,
      ctx: {
        user: { sub: participantId, role: UserRole.PARTICIPANT },
        featureFlags: { isEnabled },
        prisma,
        activityArtifactRuntime: runtime,
      } as unknown as ContextWithUser,
    }
  }

  function allowedPrisma(pin = storedPin) {
    const findUnique = vi.fn().mockResolvedValue({
      id: 42,
      elementData: { options: { activityArtifact: pin } },
      elementStack: {
        microLearning: { id: microLearningId, courseId },
      },
    })
    const findParticipation = vi
      .fn()
      .mockResolvedValue({ id: 'participation-1' })
    const findDerivedPermission = vi.fn().mockResolvedValue({ id: 7 })

    return {
      findUnique,
      findParticipation,
      findDerivedPermission,
      prisma: {
        elementInstance: { findUnique },
        participation: { findUnique: findParticipation },
        derivedPermission: { findFirst: findDerivedPermission },
      },
    }
  }

  function allowedRuntime() {
    return {
      publisherOrigin,
      serviceUrl,
      frameOrigin: publisherOrigin,
      getLatest: vi.fn(),
      getRevision: vi.fn().mockResolvedValue(clientRevision),
      assign: vi.fn().mockResolvedValue('bound'),
    }
  }

  it('returns only a generic unavailable result to an enrolled participant while the flag is off', async () => {
    const { prisma, findParticipation, findDerivedPermission } = allowedPrisma()
    const runtime = allowedRuntime()
    const { ctx, isEnabled } = participantContext({
      enabled: false,
      prisma,
      runtime,
    })

    const result = await getActivityArtifactForInstance(
      { elementInstanceId: 42 },
      ctx
    )

    expect(result).toEqual({ available: false, artifact: null })
    expect(Object.keys(result ?? {})).toEqual(['available', 'artifact'])
    expect(findParticipation).toHaveBeenCalledWith({
      where: {
        courseId_participantId: { courseId, participantId },
      },
      select: { id: true },
    })
    expect(findDerivedPermission).toHaveBeenCalled()
    expect(runtime.assign).not.toHaveBeenCalled()
    expect(runtime.getRevision).not.toHaveBeenCalled()
    expect(isEnabled).toHaveBeenCalledWith('activity-artifacts', {
      id: participantId,
      actorType: 'participant',
      role: UserRole.PARTICIPANT,
    })
  })

  it('serves only a current published Microlearning to an enrolled participant', async () => {
    const { prisma, findUnique, findParticipation, findDerivedPermission } =
      allowedPrisma()
    const runtime = allowedRuntime()
    const { ctx } = participantContext({ prisma, runtime })

    await expect(
      getActivityArtifactForInstance({ elementInstanceId: 42 }, ctx)
    ).resolves.toMatchObject({
      available: true,
      artifact: {
        revisionId,
        frameUrl: `${publisherOrigin}/frame`,
      },
    })

    const instanceQuery = findUnique.mock.calls[0]![0]
    expect(instanceQuery.where).toMatchObject({
      type: 'MICROLEARNING',
      elementType: 'CONTENT',
    })
    expect(instanceQuery.where.elementStack).toMatchObject({
      type: 'MICROLEARNING',
      microLearning: {
        status: 'PUBLISHED',
        isDeleted: false,
        scheduledStartAt: { lte: expect.any(Date) },
        scheduledEndAt: { gte: expect.any(Date) },
        course: { deletionRequestedAt: null },
      },
    })
    expect(instanceQuery.where.elementStack).not.toHaveProperty('practiceQuiz')
    expect(instanceQuery.where.elementStack).not.toHaveProperty('groupActivity')
    expect(instanceQuery).not.toHaveProperty('elementBlockId')
    expect(findParticipation).toHaveBeenCalledWith({
      where: {
        courseId_participantId: { courseId, participantId },
      },
      select: { id: true },
    })
    expect(findParticipation.mock.calls[0]![0].where).not.toHaveProperty(
      'isActive'
    )
    expect(findDerivedPermission).toHaveBeenCalledWith({
      where: {
        userId: storedPin.subject,
        microLearningId,
        permissionLevel: { in: ['ADMIN', 'OWNER'] },
      },
      select: { id: true },
    })
    expect(runtime.assign).not.toHaveBeenCalled()
    expect(runtime.getRevision).toHaveBeenCalledWith({
      subject: participantId,
      artifactId,
      revisionId,
      run: {
        participantId,
        courseId,
        elementInstanceId: 42,
        bindingInstanceId: `42:${revisionId}`,
      },
    })
  })

  it('restores the same stored revision after the participant flag is re-enabled', async () => {
    const { prisma } = allowedPrisma()
    const runtime = allowedRuntime()
    const isEnabled = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    const ctx = {
      user: { sub: participantId, role: UserRole.PARTICIPANT },
      featureFlags: { isEnabled },
      prisma,
      activityArtifactRuntime: runtime,
    } as unknown as ContextWithUser

    await expect(
      getActivityArtifactForInstance({ elementInstanceId: 42 }, ctx)
    ).resolves.toEqual({ available: false, artifact: null })
    await expect(
      getActivityArtifactForInstance({ elementInstanceId: 42 }, ctx)
    ).resolves.toMatchObject({
      available: true,
      artifact: { revisionId, digest, url: canonicalUrl },
    })

    expect(runtime.assign).not.toHaveBeenCalled()
    expect(runtime.getRevision).toHaveBeenCalledTimes(1)
    expect(runtime.getRevision).toHaveBeenCalledWith({
      subject: participantId,
      artifactId,
      revisionId,
      run: {
        participantId,
        courseId,
        elementInstanceId: 42,
        bindingInstanceId: `42:${revisionId}`,
      },
    })
  })

  it('reads a historical numeric binding without replacing it', async () => {
    const { prisma } = allowedPrisma()
    const runtime = allowedRuntime()
    runtime.getRevision
      .mockRejectedValueOnce(
        new ActivityArtifactRequestError('binding unavailable', 404)
      )
      .mockResolvedValueOnce(clientRevision)
    const { ctx } = participantContext({ prisma, runtime })

    await expect(
      getActivityArtifactForInstance({ elementInstanceId: 42 }, ctx)
    ).resolves.toMatchObject({
      available: true,
      artifact: { revisionId, digest, url: canonicalUrl },
    })

    expect(runtime.getRevision).toHaveBeenNthCalledWith(1, {
      subject: participantId,
      artifactId,
      revisionId,
      run: {
        participantId,
        courseId,
        elementInstanceId: 42,
        bindingInstanceId: `42:${revisionId}`,
      },
    })
    expect(runtime.getRevision).toHaveBeenNthCalledWith(2, {
      subject: participantId,
      artifactId,
      revisionId,
      run: {
        participantId,
        courseId,
        elementInstanceId: 42,
        bindingInstanceId: '42',
      },
    })
    expect(runtime.assign).not.toHaveBeenCalled()
  })

  it('keeps a pinned revision readable after the renderer shell changes', async () => {
    const { prisma } = allowedPrisma()
    const runtime = allowedRuntime()
    runtime.getRevision.mockResolvedValue({
      ...clientRevision,
      renderedDigest: 'c'.repeat(64),
    })
    const { ctx } = participantContext({ prisma, runtime })

    await expect(
      getActivityArtifactForInstance({ elementInstanceId: 42 }, ctx)
    ).resolves.toMatchObject({
      available: true,
      artifact: {
        revisionId,
        digest: storedPin.digest,
        renderedDigest: 'c'.repeat(64),
      },
    })
  })

  it('compares canonical exercise fields while preserving cashflow order', async () => {
    const orderedExercise = {
      ...clientRevision.exercise,
      cashflows: [
        { when: 'year-end' as const, amount: 40 },
        { when: 'maturity' as const, amount: 'face' as const },
      ],
    }
    const orderedPin = sanitizeActivityArtifactPin({
      ...revisionPayload,
      exercise: orderedExercise,
      subject: 'lecturer-1',
    })!
    const { prisma } = allowedPrisma(orderedPin)
    const runtime = allowedRuntime()
    runtime.getRevision.mockResolvedValueOnce({
      ...clientRevision,
      exercise: {
        cashflows: orderedExercise.cashflows,
        face: orderedExercise.face,
        years: orderedExercise.years,
        title: orderedExercise.title,
      },
    })
    const { ctx } = participantContext({ prisma, runtime })

    await expect(
      getActivityArtifactForInstance({ elementInstanceId: 42 }, ctx)
    ).resolves.toMatchObject({ artifact: { revisionId } })

    runtime.getRevision.mockResolvedValueOnce({
      ...clientRevision,
      exercise: {
        ...orderedExercise,
        cashflows: [...orderedExercise.cashflows].reverse(),
      },
    })
    await expect(
      getActivityArtifactForInstance({ elementInstanceId: 42 }, ctx)
    ).resolves.toEqual({ available: false, artifact: null })
  })

  it('denies a pinned revision when its source digest changes', async () => {
    const { prisma } = allowedPrisma()
    const runtime = allowedRuntime()
    runtime.getRevision.mockResolvedValue({
      ...clientRevision,
      digest: 'c'.repeat(64),
    })
    const { ctx } = participantContext({ prisma, runtime })

    await expect(
      getActivityArtifactForInstance({ elementInstanceId: 42 }, ctx)
    ).resolves.toEqual({ available: false, artifact: null })
  })

  it('returns nothing when the participant has no course participation', async () => {
    const missingParticipation = allowedPrisma()
    missingParticipation.findParticipation.mockResolvedValue(null)
    const missingParticipationRuntime = allowedRuntime()
    const missingParticipationContext = participantContext({
      prisma: missingParticipation.prisma,
      runtime: missingParticipationRuntime,
    }).ctx

    await expect(
      getActivityArtifactForInstance(
        { elementInstanceId: 42 },
        missingParticipationContext
      )
    ).resolves.toBeNull()
    expect(missingParticipation.findParticipation).toHaveBeenCalledWith({
      where: {
        courseId_participantId: { courseId, participantId },
      },
      select: { id: true },
    })
    expect(missingParticipationRuntime.assign).not.toHaveBeenCalled()
    expect(missingParticipationRuntime.getRevision).not.toHaveBeenCalled()
  })

  it('returns nothing for a non-participant or a lecturer without current activity rights', async () => {
    const unenrolled = allowedPrisma()
    unenrolled.findParticipation.mockResolvedValue(null)
    const unenrolledRuntime = allowedRuntime()
    const unenrolledContext = participantContext({
      prisma: unenrolled.prisma,
      runtime: unenrolledRuntime,
    }).ctx

    await expect(
      getActivityArtifactForInstance(
        { elementInstanceId: 42 },
        unenrolledContext
      )
    ).resolves.toBeNull()
    expect(unenrolledRuntime.assign).not.toHaveBeenCalled()
    expect(unenrolledRuntime.getRevision).not.toHaveBeenCalled()

    const stale = allowedPrisma()
    stale.findDerivedPermission.mockResolvedValue(null)
    const staleRuntime = allowedRuntime()
    const staleContext = participantContext({
      prisma: stale.prisma,
      runtime: staleRuntime,
    }).ctx

    await expect(
      getActivityArtifactForInstance({ elementInstanceId: 42 }, staleContext)
    ).resolves.toBeNull()
    expect(staleRuntime.assign).not.toHaveBeenCalled()
    expect(staleRuntime.getRevision).not.toHaveBeenCalled()
  })
})

describe('activity artifact check marker', () => {
  const microLearningId = 'microlearning-marker'
  const courseId = 'course-marker'
  const participantId = 'participant-marker'
  const ordinaryInstance = {
    id: 41,
    elementType: ElementType.CONTENT,
    elementData: { options: {} },
  }
  const pinnedInstance = {
    id: 42,
    elementType: ElementType.CONTENT,
    elementData: { options: { activityArtifact: contentArtifactPin } },
  }
  const otherLecturerPin = sanitizeActivityArtifactPin({
    ...contentArtifactPin,
    subject: 'lecturer-2',
  })!
  const otherLecturerInstance = {
    id: 43,
    elementType: ElementType.CONTENT,
    elementData: { options: { activityArtifact: otherLecturerPin } },
  }

  function microLearningResult(elements: unknown[]) {
    return {
      id: microLearningId,
      ownerId: 'activity-owner',
      courseId,
      status: PublicationStatus.PUBLISHED,
      isDeleted: false,
      scheduledStartAt: new Date(Date.now() - 60_000),
      scheduledEndAt: new Date(Date.now() + 60_000),
      course: { id: courseId },
      stacks: [
        {
          id: 7,
          type: 'MICROLEARNING',
          elements,
        },
      ],
    }
  }

  function markerContext({
    elements,
    participation = { id: 'participation-marker' },
    permissions = [{ userId: 'lecturer-1', microLearningId }],
    runtime = {},
  }: {
    elements: unknown[]
    participation?: { id: string } | null
    permissions?: { userId: string; microLearningId: string }[]
    runtime?: unknown
  }) {
    const findMicroLearning = vi
      .fn()
      .mockResolvedValue(microLearningResult(elements))
    const findParticipation = vi.fn().mockResolvedValue(participation)
    const findPermissions = vi.fn().mockResolvedValue(permissions)

    return {
      findMicroLearning,
      findParticipation,
      findPermissions,
      ctx: {
        user: { sub: participantId, role: UserRole.PARTICIPANT },
        featureFlags: { isEnabled: vi.fn().mockReturnValue(false) },
        activityArtifactRuntime: runtime,
        prisma: {
          microLearning: { findUnique: findMicroLearning },
          participation: { findUnique: findParticipation },
          derivedPermission: { findMany: findPermissions },
        },
      } as unknown as ContextWithUser,
    }
  }

  it('adds no artifact reads for ordinary CONTENT elements', async () => {
    const { ctx, findMicroLearning, findParticipation, findPermissions } =
      markerContext({ elements: [ordinaryInstance] })

    const result = await getMicroLearningData({ id: microLearningId }, ctx)

    expect(findMicroLearning).toHaveBeenCalledTimes(1)
    expect(findParticipation).not.toHaveBeenCalled()
    expect(findPermissions).not.toHaveBeenCalled()
    expect(result?.stacks[0]?.elements[0]).not.toHaveProperty(
      'checkActivityArtifact'
    )
  })

  it('marks only pinned instances whose lecturer still administers the activity', async () => {
    const { ctx, findParticipation, findPermissions } = markerContext({
      elements: [ordinaryInstance, pinnedInstance, otherLecturerInstance],
    })

    const result = await getMicroLearningData({ id: microLearningId }, ctx)
    const elements = result?.stacks[0]?.elements ?? []

    expect(findParticipation).toHaveBeenCalledTimes(1)
    expect(findPermissions).toHaveBeenCalledTimes(1)
    expect(findPermissions).toHaveBeenCalledWith({
      where: {
        userId: { in: ['lecturer-1', 'lecturer-2'] },
        microLearningId: { in: [microLearningId] },
        permissionLevel: { in: ['ADMIN', 'OWNER'] },
      },
      select: { userId: true, microLearningId: true },
    })
    expect(elements[0]).not.toHaveProperty('checkActivityArtifact')
    expect(elements[1]).toHaveProperty('checkActivityArtifact', true)
    expect(elements[2]).not.toHaveProperty('checkActivityArtifact')
  })

  it('does not expose the marker to outsiders or hosts without artifact configuration', async () => {
    const outsider = markerContext({
      elements: [pinnedInstance],
      participation: null,
    })
    const outsiderResult = await getMicroLearningData(
      { id: microLearningId },
      outsider.ctx
    )

    expect(outsiderResult?.stacks[0]?.elements[0]).not.toHaveProperty(
      'checkActivityArtifact'
    )
    expect(outsider.findPermissions).not.toHaveBeenCalled()

    const unconfigured = markerContext({
      elements: [pinnedInstance],
      runtime: null,
    })
    const unconfiguredResult = await getMicroLearningData(
      { id: microLearningId },
      unconfigured.ctx
    )

    expect(unconfiguredResult?.stacks[0]?.elements[0]).not.toHaveProperty(
      'checkActivityArtifact'
    )
    expect(unconfigured.findParticipation).not.toHaveBeenCalled()
    expect(unconfigured.findPermissions).not.toHaveBeenCalled()
  })

  it('marks bookmarked pinned elements without another participation lookup', async () => {
    const findParticipation = vi.fn().mockResolvedValue({
      bookmarkedElementStacks: [
        {
          id: 7,
          type: 'MICROLEARNING',
          elements: [ordinaryInstance, pinnedInstance],
          microLearning: {
            id: microLearningId,
            status: PublicationStatus.PUBLISHED,
            isDeleted: false,
            scheduledStartAt: new Date(Date.now() - 60_000),
            scheduledEndAt: new Date(Date.now() + 60_000),
          },
        },
      ],
    })
    const findPermissions = vi
      .fn()
      .mockResolvedValue([{ userId: 'lecturer-1', microLearningId }])
    const ctx = {
      user: { sub: participantId, role: UserRole.PARTICIPANT },
      activityArtifactRuntime: {},
      prisma: {
        participation: { findFirst: findParticipation },
        derivedPermission: { findMany: findPermissions },
      },
    } as unknown as ContextWithUser

    const stacks = await getBookmarkedElementStacks({ courseId }, ctx)

    expect(findParticipation).toHaveBeenCalledTimes(1)
    expect(findPermissions).toHaveBeenCalledTimes(1)
    expect(stacks[0]?.elements[0]).not.toHaveProperty('checkActivityArtifact')
    expect(stacks[0]?.elements[1]).toHaveProperty('checkActivityArtifact', true)
  })
})

describe('lecturer ContentElement artifact projection', () => {
  const query = `{
    lecturerContentElementWithArtifact {
      hasActivityArtifact
      activityArtifact { artifactId revisionId title url }
    }
  }`

  it.each([
    ['anonymous outsider', undefined],
    [
      'participant outsider',
      { sub: 'participant-1', role: UserRole.PARTICIPANT },
    ],
    [
      'temporary participant outsider',
      { sub: 'temporary-1', role: UserRole.TEMPORARY_PARTICIPANT },
    ],
  ])('returns no artifact metadata to an %s', async (_label, user) => {
    const isEnabled = vi.fn().mockReturnValue(true)
    const result = await graphql({
      schema: artifactMarkerSchema,
      source: query,
      contextValue: {
        user,
        featureFlags: { isEnabled },
        prisma: {
          participant: {
            findUnique: vi.fn().mockResolvedValue({
              dataUseAcknowledgedAt: new Date(),
              dataUseAcknowledgedVersion:
                PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
              researchConsentChoiceAt: new Date(),
              researchConsentDisclosureVersion: 'research-v1',
              learningAnalyticsChoiceAt: new Date(),
              learningAnalyticsDisclosureVersion: 'analytics-v1',
            }),
          },
        },
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.lecturerContentElementWithArtifact).toEqual({
      hasActivityArtifact: false,
      activityArtifact: null,
    })
    expect(isEnabled).not.toHaveBeenCalled()
  })

  it.each([
    ['lecturer with the flag off', UserRole.USER, false, true],
    ['lecturer with the flag on', UserRole.USER, true, false],
    ['administrator with the flag off', UserRole.ADMIN, false, true],
  ])('gates metadata for an authorized %s', async (_label, role, enabled, hidden) => {
    const isEnabled = vi.fn().mockReturnValue(enabled)
    const user = {
      sub: 'staff-1',
      role,
      catalystInstitutional: false,
      catalystIndividual: false,
    }
    const result = await graphql({
      schema: artifactMarkerSchema,
      source: query,
      contextValue: {
        user,
        featureFlags: { isEnabled },
        betaPreference: {
          userId: user.sub,
          value: Promise.resolve(false),
        },
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.lecturerContentElementWithArtifact).toMatchObject({
      hasActivityArtifact: true,
      activityArtifact: hidden ? null : { artifactId, revisionId },
    })
    expect(isEnabled).toHaveBeenCalledWith('activity-artifacts', {
      id: user.sub,
      actorType: 'user',
      catalyst: false,
      role,
      betaEnabled: false,
    })
  })
})

describe('activity artifact placement access', () => {
  it('uses one pin-only read and one batched permission query', async () => {
    const findInstances = vi
      .fn()
      .mockResolvedValue([
        { elementData: { options: { activityArtifact: contentArtifactPin } } },
      ])
    const findPermissions = vi.fn().mockResolvedValue([])
    const prisma = {
      elementInstance: { findMany: findInstances },
      derivedPermission: { findMany: findPermissions },
    } as unknown as Parameters<typeof assertActivityArtifactPinsAccessible>[1]

    await expect(
      assertActivityArtifactPinsAccessible('microlearning-1', prisma)
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })

    expect(findInstances).toHaveBeenCalledTimes(1)
    expect(findInstances).toHaveBeenCalledWith({
      where: {
        elementType: ElementType.CONTENT,
        elementStack: { microLearningId: 'microlearning-1' },
        elementData: {
          path: ['options', 'activityArtifact'],
          not: expect.anything(),
        },
      },
      select: { elementData: true },
    })
    expect(findPermissions).toHaveBeenCalledTimes(1)
    expect(findPermissions).toHaveBeenCalledWith({
      where: {
        userId: { in: [contentArtifactPin.subject] },
        microLearningId: { in: ['microlearning-1'] },
        permissionLevel: { in: ['ADMIN', 'OWNER'] },
      },
      select: { userId: true, microLearningId: true },
    })
  })

  it('reads no permissions when the activity has no pinned instances', async () => {
    const findInstances = vi.fn().mockResolvedValue([])
    const findPermissions = vi.fn()
    const prisma = {
      elementInstance: { findMany: findInstances },
      derivedPermission: { findMany: findPermissions },
    } as unknown as Parameters<typeof assertActivityArtifactPinsAccessible>[1]

    await assertActivityArtifactPinsAccessible('microlearning-1', prisma)

    expect(findPermissions).not.toHaveBeenCalled()
  })
})

describe('activity artifact publication binding', () => {
  const microLearningId = 'microlearning-1'
  const courseId = 'course-1'
  const lecturerId = 'lecturer-1'

  function publicationRuntime() {
    return {
      publisherOrigin,
      serviceUrl,
      frameOrigin: publisherOrigin,
      getLatest: vi.fn(),
      getRevision: vi.fn(),
      assign: vi.fn().mockResolvedValue('bound'),
    }
  }

  function publicationFeatureFlags(enabled = true) {
    return { isEnabled: vi.fn().mockReturnValue(enabled) }
  }

  function publicationPrisma() {
    const scheduledStartAt = new Date(Date.now() - 60_000)
    const scheduledEndAt = new Date(Date.now() + 60_000)
    const findMicroLearning = vi.fn().mockResolvedValue({
      id: microLearningId,
      status: PublicationStatus.DRAFT,
      scheduledStartAt,
      scheduledEndAt,
    })
    const findInstances = vi.fn().mockResolvedValue([
      {
        id: 42,
        elementData: { options: { activityArtifact: contentArtifactPin } },
        elementStack: { microLearning: { courseId } },
      },
    ])
    const findPermissions = vi
      .fn()
      .mockResolvedValue([{ userId: lecturerId, microLearningId }])
    const findUsers = vi.fn().mockResolvedValue([
      {
        id: lecturerId,
        role: UserRole.USER,
        catalystInstitutional: false,
        catalystIndividual: false,
        betaEnabled: false,
      },
    ])
    const updateMicroLearning = vi.fn().mockResolvedValue({
      id: microLearningId,
      status: PublicationStatus.PUBLISHED,
    })
    const updateManyMicroLearning = vi.fn().mockResolvedValue({ count: 1 })

    return {
      findMicroLearning,
      findInstances,
      findPermissions,
      findUsers,
      updateMicroLearning,
      updateManyMicroLearning,
      prisma: {
        microLearning: {
          findUnique: findMicroLearning,
          update: updateMicroLearning,
          updateMany: updateManyMicroLearning,
        },
        elementInstance: { findMany: findInstances },
        derivedPermission: { findMany: findPermissions },
        user: { findMany: findUsers },
      },
    }
  }

  it('binds each pinned instance before an immediate publish update', async () => {
    const { prisma, updateMicroLearning } = publicationPrisma()
    const runtime = publicationRuntime()
    const scheduleCompletion = vi.fn().mockResolvedValue({
      metadata: { id: 'completion-task' },
    })

    await publishMicroLearning({ id: microLearningId }, {
      prisma,
      activityArtifactRuntime: runtime,
      featureFlags: publicationFeatureFlags(),
      tasks: {
        endExpiredMicroLearning: { schedule: scheduleCompletion },
      },
      emitter: { emit: vi.fn() },
    } as unknown as ContextWithUser)

    expect(runtime.assign).toHaveBeenCalledWith({
      subject: lecturerId,
      courseId,
      instanceId: `42:${revisionId}`,
      artifactId,
      revisionId,
    })
    expect(runtime.assign.mock.invocationCallOrder[0]).toBeLessThan(
      updateMicroLearning.mock.invocationCallOrder[0]!
    )
  })

  it('does not publish or schedule completion after a binding conflict', async () => {
    const { prisma, updateMicroLearning } = publicationPrisma()
    const runtime = publicationRuntime()
    runtime.assign.mockResolvedValue('conflict')
    const scheduleCompletion = vi.fn()

    await expect(
      publishMicroLearning({ id: microLearningId }, {
        prisma,
        activityArtifactRuntime: runtime,
        featureFlags: publicationFeatureFlags(),
        tasks: {
          endExpiredMicroLearning: { schedule: scheduleCompletion },
        },
        emitter: { emit: vi.fn() },
      } as unknown as ContextWithUser)
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })

    expect(scheduleCompletion).not.toHaveBeenCalled()
    expect(updateMicroLearning).not.toHaveBeenCalled()
  })

  it('allows a same-pin retry after the database update fails', async () => {
    const { prisma, updateMicroLearning } = publicationPrisma()
    updateMicroLearning
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({
        id: microLearningId,
        status: PublicationStatus.PUBLISHED,
      })
    const runtime = publicationRuntime()
    const ctx = {
      prisma,
      activityArtifactRuntime: runtime,
      featureFlags: publicationFeatureFlags(),
      tasks: {
        endExpiredMicroLearning: {
          schedule: vi.fn().mockResolvedValue({
            metadata: { id: 'completion-task' },
          }),
        },
      },
      emitter: { emit: vi.fn() },
    } as unknown as ContextWithUser

    await expect(
      publishMicroLearning({ id: microLearningId }, ctx)
    ).rejects.toThrow('database unavailable')
    await expect(
      publishMicroLearning({ id: microLearningId }, ctx)
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })

    expect(runtime.assign).toHaveBeenCalledTimes(2)
    expect(runtime.assign.mock.calls[1]).toEqual(runtime.assign.mock.calls[0])
    expect(runtime.assign.mock.calls[0]![0]).toMatchObject({
      instanceId: `42:${revisionId}`,
    })
  })

  it('blocks a pinned publish before remote or local side effects while the owner flag is off', async () => {
    const { prisma, updateMicroLearning } = publicationPrisma()
    const runtime = publicationRuntime()
    const scheduleCompletion = vi.fn()

    await expect(
      publishMicroLearning({ id: microLearningId }, {
        prisma,
        activityArtifactRuntime: runtime,
        featureFlags: publicationFeatureFlags(false),
        tasks: {
          endExpiredMicroLearning: { schedule: scheduleCompletion },
        },
        emitter: { emit: vi.fn() },
      } as unknown as ContextWithUser)
    ).rejects.toMatchObject({
      message:
        'Re-enable activity artifacts for the linked artifact owner before publishing',
      extensions: { code: 'FORBIDDEN' },
    })

    expect(runtime.assign).not.toHaveBeenCalled()
    expect(scheduleCompletion).not.toHaveBeenCalled()
    expect(updateMicroLearning).not.toHaveBeenCalled()
  })

  it('publishes an activity without artifacts while the pilot is off', async () => {
    const { prisma, findInstances, updateMicroLearning } = publicationPrisma()
    findInstances.mockResolvedValue([])
    const scheduleCompletion = vi.fn().mockResolvedValue({
      metadata: { id: 'completion-task' },
    })

    await expect(
      publishMicroLearning({ id: microLearningId }, {
        prisma,
        featureFlags: publicationFeatureFlags(false),
        tasks: {
          endExpiredMicroLearning: { schedule: scheduleCompletion },
        },
        emitter: { emit: vi.fn() },
      } as unknown as ContextWithUser)
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })

    expect(scheduleCompletion).toHaveBeenCalledTimes(1)
    expect(updateMicroLearning).toHaveBeenCalledTimes(1)
  })

  it('treats a JSON-null pin as an ordinary content instance', async () => {
    const { prisma, findInstances, updateMicroLearning } = publicationPrisma()
    findInstances.mockResolvedValue([
      {
        id: 42,
        elementData: { options: { activityArtifact: null } },
        elementStack: { microLearning: { courseId } },
      },
    ])
    const runtime = publicationRuntime()
    const scheduleCompletion = vi.fn().mockResolvedValue({
      metadata: { id: 'completion-task' },
    })

    await expect(
      publishMicroLearning({ id: microLearningId }, {
        prisma,
        activityArtifactRuntime: runtime,
        featureFlags: publicationFeatureFlags(false),
        tasks: {
          endExpiredMicroLearning: { schedule: scheduleCompletion },
        },
        emitter: { emit: vi.fn() },
      } as unknown as ContextWithUser)
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })

    expect(findInstances.mock.calls[0]![0].where.elementData.not).toBe(
      Prisma.AnyNull
    )
    expect(runtime.assign).not.toHaveBeenCalled()
    expect(updateMicroLearning).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-null malformed pin before publication', async () => {
    const { prisma, findInstances, updateMicroLearning } = publicationPrisma()
    findInstances.mockResolvedValue([
      {
        id: 42,
        elementData: { options: { activityArtifact: {} } },
        elementStack: { microLearning: { courseId } },
      },
    ])
    const runtime = publicationRuntime()

    await expect(
      publishMicroLearning({ id: microLearningId }, {
        prisma,
        activityArtifactRuntime: runtime,
        featureFlags: publicationFeatureFlags(),
        tasks: {
          endExpiredMicroLearning: { schedule: vi.fn() },
        },
        emitter: { emit: vi.fn() },
      } as unknown as ContextWithUser)
    ).rejects.toMatchObject({
      extensions: {
        code: 'BAD_USER_INPUT',
        activityArtifactPublish: 'invalid',
      },
    })

    expect(runtime.assign).not.toHaveBeenCalled()
    expect(updateMicroLearning).not.toHaveBeenCalled()
  })

  it('marks a publisher authorization failure during publication', async () => {
    const { prisma, updateMicroLearning } = publicationPrisma()
    const runtime = publicationRuntime()
    runtime.assign.mockRejectedValue(
      new ActivityArtifactRequestError('publisher rejected binding', 403)
    )

    await expect(
      publishMicroLearning({ id: microLearningId }, {
        prisma,
        activityArtifactRuntime: runtime,
        featureFlags: publicationFeatureFlags(),
        tasks: {
          endExpiredMicroLearning: { schedule: vi.fn() },
        },
        emitter: { emit: vi.fn() },
      } as unknown as ContextWithUser)
    ).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN', activityArtifactPublish: 'forbidden' },
    })

    expect(updateMicroLearning).not.toHaveBeenCalled()
  })

  it('blocks scheduling a pinned activity before either worker task is created while the owner flag is off', async () => {
    const { prisma, findMicroLearning, updateMicroLearning } =
      publicationPrisma()
    findMicroLearning.mockResolvedValue({
      id: microLearningId,
      status: PublicationStatus.DRAFT,
      scheduledStartAt: new Date(Date.now() + 60_000),
      scheduledEndAt: new Date(Date.now() + 120_000),
    })
    const runtime = publicationRuntime()
    const schedulePublication = vi.fn()
    const scheduleCompletion = vi.fn()

    await expect(
      publishMicroLearning({ id: microLearningId }, {
        prisma,
        activityArtifactRuntime: runtime,
        featureFlags: publicationFeatureFlags(false),
        tasks: {
          publishScheduledMicroLearning: { schedule: schedulePublication },
          endExpiredMicroLearning: { schedule: scheduleCompletion },
        },
        emitter: { emit: vi.fn() },
      } as unknown as ContextWithUser)
    ).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN', activityArtifactPublish: 'forbidden' },
    })

    expect(runtime.assign).not.toHaveBeenCalled()
    expect(schedulePublication).not.toHaveBeenCalled()
    expect(scheduleCompletion).not.toHaveBeenCalled()
    expect(updateMicroLearning).not.toHaveBeenCalled()
  })

  it('uses a new binding key after an upgraded pin replaces a failed publication', async () => {
    const { prisma, findInstances, updateMicroLearning } = publicationPrisma()
    const nextRevisionId = 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
    const nextPin = sanitizeActivityArtifactPin({
      ...contentArtifactPin,
      revisionId: nextRevisionId,
    })!
    findInstances
      .mockResolvedValueOnce([
        {
          id: 42,
          elementData: { options: { activityArtifact: contentArtifactPin } },
          elementStack: { microLearning: { courseId } },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 42,
          elementData: { options: { activityArtifact: nextPin } },
          elementStack: { microLearning: { courseId } },
        },
      ])
    updateMicroLearning
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({
        id: microLearningId,
        status: PublicationStatus.PUBLISHED,
      })
    const runtime = publicationRuntime()
    const ctx = {
      prisma,
      activityArtifactRuntime: runtime,
      featureFlags: publicationFeatureFlags(),
      tasks: {
        endExpiredMicroLearning: {
          schedule: vi.fn().mockResolvedValue({
            metadata: { id: 'completion-task' },
          }),
        },
      },
      emitter: { emit: vi.fn() },
    } as unknown as ContextWithUser

    await expect(
      publishMicroLearning({ id: microLearningId }, ctx)
    ).rejects.toThrow('database unavailable')
    await expect(
      publishMicroLearning({ id: microLearningId }, ctx)
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })

    expect(runtime.assign.mock.calls[0]![0]).toMatchObject({
      revisionId,
      instanceId: `42:${revisionId}`,
    })
    expect(runtime.assign.mock.calls[1]![0]).toMatchObject({
      revisionId: nextRevisionId,
      instanceId: `42:${nextRevisionId}`,
    })
  })

  it('binds before the scheduled worker publishes the activity', async () => {
    const { prisma, updateManyMicroLearning } = publicationPrisma()
    prisma.microLearning.findUnique.mockResolvedValue({
      id: microLearningId,
      status: PublicationStatus.SCHEDULED,
    })
    const runtime = publicationRuntime()

    await handlePublishScheduledMicroLearning(
      { microLearningId },
      {
        prisma,
        activityArtifactRuntime: runtime,
        featureFlags: publicationFeatureFlags(),
        emitter: { emit: vi.fn() },
      } as unknown as Parameters<typeof handlePublishScheduledMicroLearning>[1],
      {} as Parameters<typeof handlePublishScheduledMicroLearning>[2]
    )

    expect(runtime.assign).toHaveBeenCalledTimes(1)
    expect(runtime.assign.mock.invocationCallOrder[0]).toBeLessThan(
      updateManyMicroLearning.mock.invocationCallOrder[0]!
    )
  })

  it('skips publication when the activity left the scheduled state first', async () => {
    const { prisma, updateManyMicroLearning } = publicationPrisma()
    const scheduledStartAt = new Date(Date.now() - 60_000)
    prisma.microLearning.findUnique.mockResolvedValue({
      id: microLearningId,
      status: PublicationStatus.SCHEDULED,
      scheduledStartAt,
    })
    updateManyMicroLearning.mockResolvedValue({ count: 0 })
    const runtime = publicationRuntime()
    const emitter = { emit: vi.fn() }

    const published = await handlePublishScheduledMicroLearning(
      { microLearningId },
      {
        prisma,
        activityArtifactRuntime: runtime,
        featureFlags: publicationFeatureFlags(),
        emitter,
      } as unknown as Parameters<typeof handlePublishScheduledMicroLearning>[1],
      {} as Parameters<typeof handlePublishScheduledMicroLearning>[2]
    )

    expect(published).toBe(false)
    expect(updateManyMicroLearning).toHaveBeenCalledWith({
      where: {
        id: microLearningId,
        status: PublicationStatus.SCHEDULED,
        scheduledStartAt,
      },
      data: { status: PublicationStatus.PUBLISHED },
    })
    expect(emitter.emit).not.toHaveBeenCalled()
  })

  it('leaves a scheduled activity unpublished for retry while the owner flag is off', async () => {
    const { prisma, updateManyMicroLearning } = publicationPrisma()
    prisma.microLearning.findUnique.mockResolvedValue({
      id: microLearningId,
      status: PublicationStatus.SCHEDULED,
    })
    const runtime = publicationRuntime()

    await expect(
      handlePublishScheduledMicroLearning(
        { microLearningId },
        {
          prisma,
          activityArtifactRuntime: runtime,
          featureFlags: publicationFeatureFlags(false),
          emitter: { emit: vi.fn() },
        } as unknown as Parameters<
          typeof handlePublishScheduledMicroLearning
        >[1],
        {} as Parameters<typeof handlePublishScheduledMicroLearning>[2]
      )
    ).rejects.toMatchObject({
      message:
        'Re-enable activity artifacts for the linked artifact owner before publishing',
      extensions: { code: 'FORBIDDEN', activityArtifactPublish: 'forbidden' },
    })

    expect(runtime.assign).not.toHaveBeenCalled()
    expect(updateManyMicroLearning).not.toHaveBeenCalled()
  })
})

describe('activity artifact content updates', () => {
  const previousElement = {
    id: 10,
    type: ElementType.CONTENT,
    name: 'Pinned content',
    content: '<p>Before</p>',
    basePoints: true,
    pointsMultiplier: 1,
    options: { activityArtifact: contentArtifactPin },
    answerCollectionId: null,
    answerCollectionItems: [],
    tags: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }

  function contentContext() {
    const findUnique = vi.fn()
    const upsert = vi.fn()
    const createLog = vi.fn()
    const emit = vi.fn()

    return {
      findUnique,
      upsert,
      createLog,
      emit,
      ctx: {
        user: { sub: 'lecturer-1' },
        prisma: {
          element: { findUnique, upsert },
          activityLogEntry: { create: createLog },
        },
        emitter: { emit },
      } as unknown as ContextWithUser,
    }
  }

  function microLearningGuardContext({
    activityStatus,
    conditionalResult = 'decline',
    activityMultiplier = 1,
    artifactSubject = contentArtifactPin.subject,
    artifactAccessible = true,
    currentOptions = {},
  }: {
    activityStatus: PublicationStatus
    conditionalResult?: 'pass' | 'decline'
    activityMultiplier?: number
    artifactSubject?: string
    artifactAccessible?: boolean
    currentOptions?: Record<string, unknown>
  }) {
    const microLearningId = 'microlearning-1'
    const instanceId = 42
    const observedElementData = {
      ...previousElement,
      id: `${previousElement.id}-v1`,
      elementId: previousElement.id,
    }
    const element = {
      ...previousElement,
      version: 1,
      options: {
        activityArtifact: { ...contentArtifactPin, subject: artifactSubject },
      },
      answerCollection: null,
      elementInstances: [
        {
          id: instanceId,
          elementData: observedElementData,
          elementBlock: null,
          elementStack: {
            microLearning: {
              id: microLearningId,
              status: activityStatus,
              pointsMultiplier: 1,
              templateInfo: null,
              reviewStatus: null,
            },
          },
        },
      ],
    }
    const guardedStatuses: PublicationStatus[] = []
    const conditionalUpdate = vi
      .fn()
      .mockResolvedValue(
        conditionalResult === 'pass' ? [{ id: instanceId }] : []
      )
    const directUpdate = vi.fn()
    const findPermissions = vi.fn(
      async ({
        where,
      }: {
        where: {
          userId: { in: string[] }
          microLearningId: { in: string[] }
        }
      }) =>
        artifactAccessible
          ? where.microLearningId.in.map((id) => ({
              userId: where.userId.in[0],
              microLearningId: id,
            }))
          : []
    )
    const prisma = {
      element: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(element)
          .mockResolvedValue({ id: previousElement.id, version: 1 }),
      },
      elementInstance: {
        findUnique: vi.fn().mockResolvedValue({
          id: instanceId,
          elementData: observedElementData,
          options: currentOptions,
        }),
        findMany: vi.fn().mockResolvedValue([]),
        updateManyAndReturn: conditionalUpdate,
        update: directUpdate,
      },
      derivedPermission: { findMany: findPermissions },
      $queryRaw: vi.fn(
        async (
          _strings: TemplateStringsArray,
          _id: string,
          statuses: PublicationStatus[]
        ) => {
          guardedStatuses.push(...statuses)
          return statuses.includes(activityStatus)
            ? [{ id: microLearningId, pointsMultiplier: activityMultiplier }]
            : []
        }
      ),
      $transaction: vi.fn(),
    }
    prisma.$transaction.mockImplementation(
      async (callback: (prisma: unknown) => Promise<unknown>) =>
        await callback(prisma)
    )

    return {
      conditionalUpdate,
      currentOptions,
      directUpdate,
      findElement: prisma.element.findUnique,
      findPermissions,
      guardedStatuses,
      instanceId,
      microLearningId,
      observedElementData,
      prisma,
    }
  }

  it('omits the options write when a generic edit supplies empty CONTENT options', async () => {
    const { ctx, findUnique, upsert } = contentContext()
    findUnique.mockResolvedValue(previousElement)
    upsert.mockResolvedValue({ ...previousElement, version: 2 })

    await manipulateElement(
      {
        id: previousElement.id,
        type: ElementType.CONTENT,
        content: '<p>After</p>',
        options: {},
      },
      ctx
    )

    expect(upsert.mock.calls[0]![0].update.options).toBeUndefined()
  })

  it('keeps the empty options object for a new unpinned CONTENT element', async () => {
    const { ctx, findUnique, upsert, createLog } = contentContext()
    const created = {
      ...previousElement,
      id: 11,
      name: 'Unpinned content',
      options: {},
      version: 1,
    }
    upsert.mockResolvedValue(created)

    await manipulateElement(
      {
        status: ElementStatus.DRAFT,
        type: ElementType.CONTENT,
        name: created.name,
        content: created.content,
        options: {},
      },
      ctx
    )

    expect(findUnique).not.toHaveBeenCalled()
    expect(upsert.mock.calls[0]![0].create.options).toEqual({})
    expect(createLog).toHaveBeenCalledTimes(1)
  })

  it('guards an unchanged-pin Microlearning snapshot with its observed element data', async () => {
    const {
      conditionalUpdate,
      directUpdate,
      guardedStatuses,
      instanceId,
      microLearningId,
      observedElementData,
      prisma,
    } = microLearningGuardContext({ activityStatus: PublicationStatus.DRAFT })

    await expect(
      updateElementInstances(
        { elementId: previousElement.id, includeTemplates: false },
        prisma as never,
        { emit: vi.fn() } as never,
        'lecturer-1'
      )
    ).resolves.toEqual([])

    expect(conditionalUpdate).toHaveBeenCalledTimes(1)
    expect(conditionalUpdate.mock.calls[0]![0]).toMatchObject({
      where: {
        id: instanceId,
        AND: [
          { elementData: { equals: observedElementData } },
          {
            elementStack: {
              microLearning: {
                id: microLearningId,
                status: {
                  in: [PublicationStatus.DRAFT, PublicationStatus.SCHEDULED],
                },
              },
            },
          },
        ],
      },
    })
    expect(directUpdate).not.toHaveBeenCalled()
    expect(guardedStatuses).toEqual([
      PublicationStatus.DRAFT,
      PublicationStatus.SCHEDULED,
    ])
  })

  it('uses the locked activity multiplier and current instance options', async () => {
    const { conditionalUpdate, currentOptions, prisma } =
      microLearningGuardContext({
        activityStatus: PublicationStatus.SCHEDULED,
        conditionalResult: 'pass',
        activityMultiplier: 2,
        currentOptions: { pointsMultiplier: 2, retained: 'newer' },
      })

    await expect(
      updateElementInstances(
        { elementId: previousElement.id, includeTemplates: false },
        prisma as never,
        { emit: vi.fn() } as never,
        'lecturer-1'
      )
    ).resolves.toHaveLength(1)

    expect(conditionalUpdate.mock.calls[0]![0].data.options).toEqual({
      ...currentOptions,
      basePoints: true,
      pointsMultiplier: 2,
    })
  })

  it('rejects a replacement pin when the guarded recheck finds no activity access', async () => {
    const {
      conditionalUpdate,
      directUpdate,
      findPermissions,
      guardedStatuses,
      microLearningId,
      prisma,
    } = microLearningGuardContext({
      activityStatus: PublicationStatus.SCHEDULED,
      conditionalResult: 'pass',
      artifactSubject: 'lecturer-without-admin-access',
      artifactAccessible: true,
    })
    findPermissions
      .mockResolvedValueOnce([
        {
          userId: 'lecturer-without-admin-access',
          microLearningId,
        },
      ])
      .mockResolvedValueOnce([])

    await expect(
      updateElementInstances(
        { elementId: previousElement.id, includeTemplates: false },
        prisma as never,
        { emit: vi.fn() } as never,
        'lecturer-1'
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })

    expect(findPermissions).toHaveBeenCalledTimes(2)
    expect(guardedStatuses).toEqual([
      PublicationStatus.DRAFT,
      PublicationStatus.SCHEDULED,
    ])
    expect(conditionalUpdate).not.toHaveBeenCalled()
    expect(directUpdate).not.toHaveBeenCalled()
  })

  it('allows a template refresh when templates are included', async () => {
    const { conditionalUpdate, guardedStatuses, microLearningId, prisma } =
      microLearningGuardContext({
        activityStatus: PublicationStatus.TEMPLATE,
        conditionalResult: 'pass',
      })

    await expect(
      updateElementInstances(
        { elementId: previousElement.id, includeTemplates: true },
        prisma as never,
        { emit: vi.fn() } as never,
        'lecturer-1'
      )
    ).resolves.toHaveLength(1)

    expect(conditionalUpdate).toHaveBeenCalledTimes(1)
    expect(conditionalUpdate.mock.calls[0]![0]).toMatchObject({
      where: {
        AND: [
          expect.anything(),
          {
            elementStack: {
              microLearning: {
                id: microLearningId,
                status: {
                  in: [
                    PublicationStatus.DRAFT,
                    PublicationStatus.SCHEDULED,
                    PublicationStatus.TEMPLATE,
                  ],
                },
              },
            },
          },
        ],
      },
    })
    expect(guardedStatuses).toEqual([
      PublicationStatus.DRAFT,
      PublicationStatus.SCHEDULED,
      PublicationStatus.TEMPLATE,
    ])
    expect(guardedStatuses).not.toContain(PublicationStatus.PUBLISHED)
  })

  it('declines a template refresh when templates are excluded', async () => {
    const { conditionalUpdate, findElement, guardedStatuses, prisma } =
      microLearningGuardContext({
        activityStatus: PublicationStatus.TEMPLATE,
        conditionalResult: 'pass',
      })

    await expect(
      updateElementInstances(
        { elementId: previousElement.id, includeTemplates: false },
        prisma as never,
        { emit: vi.fn() } as never,
        'lecturer-1'
      )
    ).resolves.toEqual([])

    expect(conditionalUpdate).not.toHaveBeenCalled()
    expect(guardedStatuses).toEqual([
      PublicationStatus.DRAFT,
      PublicationStatus.SCHEDULED,
    ])
    expect(guardedStatuses).not.toContain(PublicationStatus.PUBLISHED)
    expect(
      findElement.mock.calls[0]![0].include.elementInstances.include
        .elementStack.include.microLearning.where.status.in
    ).toEqual([PublicationStatus.DRAFT, PublicationStatus.SCHEDULED])
  })
})

describe('activity artifact configuration', () => {
  it('fails closed without a complete configuration', () => {
    expect(createActivityArtifactRuntimeFromEnv({})).toBeUndefined()
    expect(
      createActivityArtifactRuntimeFromEnv({
        ACTIVITY_ARTIFACT_ORIGIN: publisherOrigin,
        ACTIVITY_ARTIFACT_SERVICE_URL: serviceUrl,
      })
    ).toBeUndefined()
    expect(
      createActivityArtifactRuntimeFromEnv({
        ACTIVITY_ARTIFACT_ORIGIN: 'http://publisher.example',
        ACTIVITY_ARTIFACT_SERVICE_URL: serviceUrl,
        ACTIVITY_ARTIFACT_SERVICE_TOKEN: 'service-token',
      })
    ).toBeUndefined()
  })

  it('builds the fixed frame origin from the configured publisher', () => {
    const runtime = createActivityArtifactRuntimeFromEnv({
      ACTIVITY_ARTIFACT_ORIGIN: publisherOrigin,
      ACTIVITY_ARTIFACT_SERVICE_URL: serviceUrl,
      ACTIVITY_ARTIFACT_SERVICE_TOKEN: 'service-token',
    })

    expect(runtime?.frameOrigin).toBe(publisherOrigin)
    expect(runtime?.serviceUrl).toBe(serviceUrl)
  })
})
