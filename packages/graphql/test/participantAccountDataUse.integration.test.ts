import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import {
  isParticipantDataUseComplete,
  PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
} from '@klicker-uzh/util'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  completeParticipantDataUse,
  updateParticipantDataUseChoice,
} from '../src/services/participantAccountDataUse.js'

const TEST_PREFIX = `participant-account-data-use-integration-${Date.now()}-${randomUUID()}`
const { graphql } = createRequire(import.meta.url)(
  'graphql'
) as typeof import('graphql')

const fixtureIds = {
  participants: [] as string[],
}

type CompletionInput = {
  expectedRevision: number
  disclosureVersion: string
  researchConsent: boolean
  learningAnalyticsConsent: boolean
  acknowledged: true
}

type CompletionOverrides = Partial<Omit<CompletionInput, 'acknowledged'>>

function completionInput(overrides: CompletionOverrides = {}): CompletionInput {
  return {
    expectedRevision: 0,
    disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    researchConsent: false,
    learningAnalyticsConsent: false,
    ...overrides,
    acknowledged: true,
  }
}

function contextFor(
  participantId: string,
  role: UserRole = UserRole.PARTICIPANT,
  client = prisma
): ContextWithUser {
  return {
    prisma: client,
    user: {
      sub: participantId,
      role,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

async function createParticipant(
  label: string,
  data: Partial<{
    researchConsent: boolean
    researchConsentChoiceAt: Date | null
    researchConsentDisclosureVersion: string | null
    learningAnalyticsConsent: boolean
    learningAnalyticsChoiceAt: Date | null
    learningAnalyticsDisclosureVersion: string | null
    dataUseAcknowledgedAt: Date | null
    dataUseAcknowledgedVersion: string | null
    dataUseRevision: number
  }> = {}
) {
  await requireDisposableDatabase(prisma)
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${label}`,
      password: 'synthetic-integration-password',
      ...data,
    },
  })
  fixtureIds.participants.push(participant.id)
  return participant
}

async function readAccountDataUse(participantId: string) {
  return prisma.participant.findUnique({
    where: { id: participantId },
    select: {
      researchConsent: true,
      researchConsentChoiceAt: true,
      researchConsentDisclosureVersion: true,
      learningAnalyticsConsent: true,
      learningAnalyticsChoiceAt: true,
      learningAnalyticsDisclosureVersion: true,
      dataUseAcknowledgedAt: true,
      dataUseAcknowledgedVersion: true,
      dataUseRevision: true,
    },
  })
}

async function readEvents(participantId: string) {
  return prisma.participantDataUseEvent.findMany({
    where: { participantId },
    orderBy: { revision: 'asc' },
  })
}

async function cleanupFixture() {
  await requireDisposableDatabase(prisma)
  if (fixtureIds.participants.length > 0) {
    await prisma.participant.deleteMany({
      where: { id: { in: fixtureIds.participants } },
    })
  }
}

describe('complete participant account data-use PostgreSQL integration', () => {
  beforeAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.$connect()
  })

  afterAll(async () => {
    await cleanupFixture()
    await prisma.$disconnect()
  })

  it('completes through GraphQL and reads persisted self-state with both purposes declined', async () => {
    const participant = await createParticipant('graphql-completion')
    const ctx = contextFor(participant.id)
    const completed = await graphql({
      schema,
      source: `mutation Complete($version: String!) {
        completeParticipantDataUse(expectedRevision: 0, disclosureVersion: $version,
          researchConsent: false, learningAnalyticsConsent: false, acknowledged: true) {
          isComplete dataUseRevision researchConsent learningAnalyticsConsent
        }
      }`,
      variableValues: { version: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION },
      contextValue: ctx,
    })
    expect(completed.errors).toBeUndefined()
    expect(completed.data?.completeParticipantDataUse).toMatchObject({
      isComplete: true,
      dataUseRevision: 1,
      researchConsent: false,
      learningAnalyticsConsent: false,
    })
    const source = '{ selfAccountDataUse { isComplete dataUseRevision } }'
    const reloaded = await graphql({ schema, source, contextValue: ctx })
    expect(reloaded.errors).toBeUndefined()
    expect(reloaded.data?.selfAccountDataUse).toMatchObject({
      isComplete: true,
      dataUseRevision: 1,
    })
    const denied = await graphql({
      schema,
      source,
      contextValue: contextFor(participant.id, UserRole.USER),
    })
    expect(denied.errors?.length).toBeGreaterThan(0)
    expect(denied.data?.selfAccountDataUse).toBeNull()
  })

  it('rechecks persisted completion for an existing session before protected GraphQL fields', async () => {
    const participant = await createParticipant('persisted-gate')
    const ctx = contextFor(participant.id)
    const source = '{ participantCourses { id } }'
    const denied = await graphql({ schema, source, contextValue: ctx })
    expect(denied.errors?.[0]?.extensions.code).toBe(
      'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED'
    )
    await completeParticipantDataUse(completionInput(), ctx)
    const allowed = await graphql({ schema, source, contextValue: ctx })
    expect(allowed.errors).toBeUndefined()
    expect(allowed.data?.participantCourses).toEqual([])
    await prisma.participant.update({
      where: { id: participant.id },
      data: { dataUseAcknowledgedVersion: 'superseded' },
    })
    const renewed = await graphql({ schema, source, contextValue: ctx })
    expect(renewed.errors?.[0]?.extensions.code).toBe(
      'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED'
    )
    const support = await graphql({
      schema,
      source: '{ selfAccountDataUse { isComplete } }',
      contextValue: ctx,
    })
    expect(support.errors).toBeUndefined()
    expect(support.data?.selfAccountDataUse).toMatchObject({
      isComplete: false,
    })
  })

  it('updates research independently with an audit revision and preserves analytics and acknowledgement', async () => {
    const participant = await createParticipant('profile-research')
    const ctx = contextFor(participant.id)
    const before = await completeParticipantDataUse(completionInput(), ctx)
    const input = {
      consent: true,
      expectedRevision: 1,
      disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    }
    const after = await updateParticipantDataUseChoice('research', input, ctx)
    expect(after).toMatchObject({
      researchConsent: true,
      learningAnalyticsConsent: false,
      dataUseRevision: 2,
    })
    expect(after.learningAnalyticsChoiceAt).toEqual(
      before.learningAnalyticsChoiceAt
    )
    expect(after.dataUseAcknowledgedAt).toEqual(before.dataUseAcknowledgedAt)
    await updateParticipantDataUseChoice(
      'research',
      { ...input, expectedRevision: 2 },
      ctx
    )
    expect(await readEvents(participant.id)).toHaveLength(2)
    await expect(
      updateParticipantDataUseChoice(
        'research',
        { ...input, consent: false },
        ctx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_STALE_REVISION' },
    })
    expect((await readAccountDataUse(participant.id))?.researchConsent).toBe(
      true
    )
  })

  it('rejects a legacy Boolean-only profile mutation and persists revisioned GraphQL choices', async () => {
    const participant = await createParticipant('profile-graphql')
    const ctx = contextFor(participant.id)
    await completeParticipantDataUse(completionInput(), ctx)
    const old = await graphql({
      schema,
      source:
        'mutation { setResearchConsent(consent: true) { researchConsent } }',
      contextValue: ctx,
    })
    expect(old.errors?.[0]?.extensions.code).toBe(
      'PARTICIPANT_DATA_USE_INVALID_INPUT'
    )
    const current = await graphql({
      schema,
      source:
        'mutation Save($version: String!) { setResearchConsent(consent: true, expectedRevision: 1, disclosureVersion: $version) { researchConsent learningAnalyticsConsent } }',
      variableValues: { version: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION },
      contextValue: ctx,
    })
    expect(current.errors).toBeUndefined()
    expect(current.data?.setResearchConsent).toMatchObject({
      researchConsent: true,
      learningAnalyticsConsent: false,
    })
    expect((await readAccountDataUse(participant.id))?.dataUseRevision).toBe(2)
  })

  it('does not renew acknowledgement through an independent choice mutation', async () => {
    const participant = await createParticipant('profile-locked')
    await expect(
      updateParticipantDataUseChoice(
        'research',
        {
          consent: true,
          expectedRevision: 0,
          disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        },
        contextFor(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED' },
    })
    expect(await readEvents(participant.id)).toHaveLength(0)
  })

  it('protects choice audit history while preserving account deletion', async () => {
    const participant = await createParticipant('immutable-audit')
    await completeParticipantDataUse(
      completionInput(),
      contextFor(participant.id)
    )
    const [event] = await readEvents(participant.id)
    expect(event).toBeDefined()
    await expect(
      prisma.participantDataUseEvent.update({
        where: { id: event!.id },
        data: { researchConsent: true },
      })
    ).rejects.toThrow()
    await expect(
      prisma.participantDataUseEvent.delete({ where: { id: event!.id } })
    ).rejects.toThrow()
    expect(await readEvents(participant.id)).toHaveLength(1)
    await prisma.participant.delete({ where: { id: participant.id } })
    expect(await readEvents(participant.id)).toHaveLength(0)
  })

  it('preserves public guest reads while denying incomplete registered identities', async () => {
    const participant = await createParticipant('public-gate')
    const source = `{ basicCourseInformation(courseId: "${randomUUID()}") { id } }`
    for (const user of [
      undefined,
      {
        ...contextFor(participant.id).user,
        role: UserRole.TEMPORARY_PARTICIPANT,
      },
      { ...contextFor(participant.id).user, role: UserRole.USER },
    ]) {
      const result = await graphql({
        schema,
        source,
        contextValue: { prisma, user },
      })
      expect(result.errors).toBeUndefined()
      expect(result.data?.basicCourseInformation).toBeNull()
    }
    const denied = await graphql({
      schema,
      source,
      contextValue: contextFor(participant.id),
    })
    expect(denied.errors?.[0]?.extensions.code).toBe(
      'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED'
    )
  })

  it('checks subscription admission and delivery against current completion', async () => {
    const participant = await createParticipant('subscription-gate')
    const ctx = contextFor(participant.id)
    const subscribe = vi.fn().mockReturnValue({})
    ctx.pubSub = { subscribe } as any
    const field = schema.getSubscriptionType()!.getFields()
      .runningLiveQuizUpdated!
    await expect(
      field.subscribe!(undefined, { id: 'synthetic' }, ctx, {} as any)
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED' },
    })
    expect(subscribe).not.toHaveBeenCalled()
    await completeParticipantDataUse(completionInput(), ctx)
    const payload = { id: 'synthetic' }
    expect(await field.resolve!(payload, {}, ctx, {} as any)).toBe(payload)
    await prisma.participant.update({
      where: { id: participant.id },
      data: { dataUseAcknowledgedVersion: 'superseded' },
    })
    await expect(
      field.resolve!(payload, {}, ctx, {} as any)
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED' },
    })
  })

  it('persists the initial false choices, acknowledgement, revision, and audit event', async () => {
    const participant = await createParticipant('initial-completion')
    const initialState = await readAccountDataUse(participant.id)

    expect(isParticipantDataUseComplete(initialState)).toBe(false)

    const result = await completeParticipantDataUse(
      completionInput(),
      contextFor(participant.id)
    )

    expect(result).toMatchObject({
      id: participant.id,
      researchConsent: false,
      researchConsentChoiceAt: expect.any(Date),
      researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      learningAnalyticsConsent: false,
      learningAnalyticsChoiceAt: expect.any(Date),
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      dataUseAcknowledgedAt: expect.any(Date),
      dataUseAcknowledgedVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      dataUseRevision: 1,
    })

    await expect(readEvents(participant.id)).resolves.toMatchObject([
      {
        revision: 1,
        disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        researchConsent: false,
        learningAnalyticsConsent: false,
        acknowledged: true,
        createdAt: expect.any(Date),
      },
    ])
    const persistedState = await readAccountDataUse(participant.id)

    expect(persistedState).toMatchObject({
      researchConsent: false,
      researchConsentChoiceAt: expect.any(Date),
      researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      learningAnalyticsConsent: false,
      learningAnalyticsChoiceAt: expect.any(Date),
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      dataUseAcknowledgedAt: expect.any(Date),
      dataUseAcknowledgedVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      dataUseRevision: 1,
    })
    expect(isParticipantDataUseComplete(persistedState)).toBe(true)
  })

  it('treats an identical retry as idempotent and records one audit event', async () => {
    const participant = await createParticipant('idempotent-retry')
    const request = completionInput()
    const context = contextFor(participant.id)

    const first = await completeParticipantDataUse(request, context)
    const retry = await completeParticipantDataUse(request, context)

    expect(retry).toEqual(first)
    await expect(readEvents(participant.id)).resolves.toHaveLength(1)
  })

  it('rejects a stale revision with different choices without changing state', async () => {
    const participant = await createParticipant('stale-revision')
    const context = contextFor(participant.id)
    await completeParticipantDataUse(completionInput(), context)
    const before = await readAccountDataUse(participant.id)
    const eventsBefore = await readEvents(participant.id)

    await expect(
      completeParticipantDataUse(
        completionInput({ researchConsent: true }),
        context
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_STALE_REVISION' },
    })

    await expect(readAccountDataUse(participant.id)).resolves.toEqual(before)
    await expect(readEvents(participant.id)).resolves.toEqual(eventsBefore)
  })

  it('rejects an unknown disclosure version without writing fixture state', async () => {
    const participant = await createParticipant('wrong-disclosure')
    const before = await readAccountDataUse(participant.id)

    await expect(
      completeParticipantDataUse(
        completionInput({ disclosureVersion: 'synthetic-unknown-version' }),
        contextFor(participant.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_INVALID_INPUT' },
    })

    await expect(readAccountDataUse(participant.id)).resolves.toEqual(before)
    await expect(readEvents(participant.id)).resolves.toHaveLength(0)
  })

  it('rolls back the participant update when audit creation fails', async () => {
    const participant = await createParticipant('audit-failure')
    const failingPrisma = prisma.$extends({
      query: {
        participantDataUseEvent: {
          async create() {
            throw new Error('Synthetic audit event creation failure')
          },
        },
      },
    })
    const before = await readAccountDataUse(participant.id)

    await expect(
      completeParticipantDataUse(
        completionInput(),
        contextFor(
          participant.id,
          UserRole.PARTICIPANT,
          failingPrisma as unknown as typeof prisma
        )
      )
    ).rejects.toBeInstanceOf(Error)

    await expect(readAccountDataUse(participant.id)).resolves.toEqual(before)
    await expect(readEvents(participant.id)).resolves.toHaveLength(0)
  })

  it('renews the acknowledgement while preserving existing consent timestamps', async () => {
    const researchChoiceAt = new Date('2020-01-01T08:00:00.000Z')
    const analyticsChoiceAt = new Date('2020-01-01T08:01:00.000Z')
    const acknowledgementAt = new Date('2020-01-01T08:02:00.000Z')
    const participant = await createParticipant('acknowledgement-renewal', {
      researchConsentChoiceAt: researchChoiceAt,
      researchConsentDisclosureVersion: 'synthetic-previous-version',
      learningAnalyticsChoiceAt: analyticsChoiceAt,
      learningAnalyticsDisclosureVersion: 'synthetic-previous-version',
      dataUseAcknowledgedAt: acknowledgementAt,
      dataUseAcknowledgedVersion: 'synthetic-previous-version',
      dataUseRevision: 3,
    })

    const result = await completeParticipantDataUse(
      completionInput({ expectedRevision: 3 }),
      contextFor(participant.id)
    )

    expect(result).toMatchObject({
      dataUseAcknowledgedVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      dataUseRevision: 4,
    })
    expect(result.researchConsentDisclosureVersion).toBe(
      'synthetic-previous-version'
    )
    expect(result.learningAnalyticsDisclosureVersion).toBe(
      'synthetic-previous-version'
    )
    expect(isParticipantDataUseComplete(result)).toBe(true)
    expect(result.researchConsentChoiceAt).toEqual(researchChoiceAt)
    expect(result.learningAnalyticsChoiceAt).toEqual(analyticsChoiceAt)
    expect(result.dataUseAcknowledgedAt).toEqual(expect.any(Date))
    expect(result.dataUseAcknowledgedAt).not.toEqual(acknowledgementAt)
    await expect(readEvents(participant.id)).resolves.toMatchObject([
      {
        revision: 4,
        disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        researchConsent: false,
        learningAnalyticsConsent: false,
        acknowledged: true,
      },
    ])
  })

  it('rejects a non-participant role without changing participant state', async () => {
    const participant = await createParticipant('role-rejection')
    const before = await readAccountDataUse(participant.id)

    await expect(
      completeParticipantDataUse(
        completionInput(),
        contextFor(participant.id, UserRole.USER)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_FORBIDDEN' },
    })

    await expect(readAccountDataUse(participant.id)).resolves.toEqual(before)
    await expect(readEvents(participant.id)).resolves.toHaveLength(0)
  })
})
