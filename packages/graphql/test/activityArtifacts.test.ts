import { UserRole } from '@klicker-uzh/prisma/client'
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
import {
  getActivityArtifactForInstance,
  previewActivityArtifactByUrl,
  resolveContentArtifactPin,
  resolveStaffActivityArtifact,
} from '../src/services/activityArtifacts.js'

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
    [403, 'BAD_USER_INPUT'],
    [404, 'BAD_USER_INPUT'],
    [503, 'SERVICE_UNAVAILABLE'],
  ])('maps publisher status %i to %s', async (status, code) => {
    const runtime = lecturerRuntime()
    runtime.getLatest.mockRejectedValue(
      new ActivityArtifactRequestError('publisher failure', status)
    )
    const { ctx } = lecturerContext(runtime)

    await expect(
      previewActivityArtifactByUrl({ url: canonicalUrl }, ctx)
    ).rejects.toMatchObject({ extensions: { code } })
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

  function allowedPrisma() {
    const findUnique = vi.fn().mockResolvedValue({
      id: 42,
      elementData: { options: { activityArtifact: storedPin } },
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

  it('denies a disabled participant flag before reading activity data', async () => {
    const prisma = new Proxy(
      {},
      {
        get() {
          throw new Error('Prisma must not be read while the flag is off')
        },
      }
    )
    const { ctx, isEnabled } = participantContext({ enabled: false, prisma })

    await expect(
      getActivityArtifactForInstance({ elementInstanceId: 42 }, ctx)
    ).resolves.toBeNull()
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
      revisionId,
      frameUrl: `${publisherOrigin}/frame`,
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
    expect(runtime.assign).toHaveBeenCalledWith({
      subject: storedPin.subject,
      courseId,
      instanceId: '42',
      artifactId,
      revisionId,
    })
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
