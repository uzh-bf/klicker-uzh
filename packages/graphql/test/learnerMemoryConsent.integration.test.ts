import { randomUUID } from 'node:crypto'

import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import {
  PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
  TUTOR_PERSONALIZATION_DISCLOSURE_VERSION,
  TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION,
} from '@klicker-uzh/util'
import { deriveLearnerMemoryKey } from '@klicker-uzh/util/learner-memory'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { deleteParticipantAccount } from '../src/services/accounts.js'
import {
  completeParticipantDataUse,
  getCurrentTutorPersonalizationDisclosureVersion,
  updateParticipantTutorPersonalizationChoice,
} from '../src/services/participantAccountDataUse.js'

const TEST_PREFIX = `learner-memory-consent-integration-${Date.now()}-${randomUUID()}`
const KEY_SECRET = 'synthetic-key-secret-with-enough-length'
const participantIds: string[] = []

/** What a deployment has configured for learner memory. */
type Deployment = 'memory' | 'key-only' | 'none'

function deploy(deployment: Deployment) {
  vi.stubEnv(
    'LEARNER_MEMORY_SERVICE_URL',
    deployment === 'memory' ? 'https://memory.synthetic.test' : ''
  )
  vi.stubEnv(
    'LEARNER_MEMORY_SERVICE_TOKEN',
    deployment === 'memory' ? 'synthetic-token' : ''
  )
  vi.stubEnv(
    'LEARNER_MEMORY_KEY_SECRET',
    deployment === 'none' ? '' : KEY_SECRET
  )
}

function contextFor(participantId: string): ContextWithUser {
  return {
    prisma,
    user: {
      sub: participantId,
      role: UserRole.PARTICIPANT,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    res: { cookie: vi.fn() },
  } as unknown as ContextWithUser
}

async function createCompletedParticipant(label: string) {
  await requireDisposableDatabase(prisma)
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${label}`,
      password: 'synthetic-integration-password',
    },
  })
  participantIds.push(participant.id)
  await completeParticipantDataUse(
    {
      expectedRevision: 0,
      disclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      researchConsent: false,
      learningAnalyticsConsent: false,
      acknowledged: true,
    },
    contextFor(participant.id)
  )
  return participant
}

function learnerKey(participantId: string) {
  const key = deriveLearnerMemoryKey(participantId, {
    LEARNER_MEMORY_KEY_SECRET: KEY_SECRET,
  })
  if (!key) throw new Error('The synthetic key secret is too short')
  return key
}

async function readEpoch(participantId: string) {
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    select: { learnerMemoryEpoch: true, dataUseRevision: true },
  })
  return participant
}

async function readForgetRequests(participantId: string) {
  return prisma.learnerMemoryForgetRequest.findMany({
    where: { learnerKey: learnerKey(participantId) },
    orderBy: { id: 'asc' },
    select: { courseId: true, epoch: true, completedAt: true },
  })
}

type Answer = 'yes' | 'no'

/** Answer the choice under the notice the given deployment shows. */
async function answer(
  participantId: string,
  deployment: Deployment,
  consent: Answer
) {
  deploy(deployment)
  const { dataUseRevision } = await readEpoch(participantId)
  return updateParticipantTutorPersonalizationChoice(
    {
      consent: consent === 'yes',
      expectedRevision: dataUseRevision,
      disclosureVersion: getCurrentTutorPersonalizationDisclosureVersion(),
    },
    contextFor(participantId)
  )
}

describe('consent to learning notes', () => {
  beforeAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.$connect()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  afterAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.learnerMemoryForgetRequest.deleteMany({
      where: { learnerKey: { in: participantIds.map(learnerKey) } },
    })
    await prisma.participant.deleteMany({
      where: { id: { in: participantIds } },
    })
    await prisma.$disconnect()
  })

  it('shows the notice with learning notes only in a deployment that keeps them', () => {
    deploy('memory')
    expect(getCurrentTutorPersonalizationDisclosureVersion()).toBe(
      TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION
    )
    for (const deployment of ['key-only', 'none'] as const) {
      deploy(deployment)
      expect(getCurrentTutorPersonalizationDisclosureVersion()).toBe(
        TUTOR_PERSONALIZATION_DISCLOSURE_VERSION
      )
    }
  })

  it('records a yes only under the notice the deployment shows', async () => {
    const participant = await createCompletedParticipant('notice-version')
    const ctx = contextFor(participant.id)

    deploy('memory')
    await expect(
      updateParticipantTutorPersonalizationChoice(
        {
          consent: true,
          expectedRevision: 1,
          disclosureVersion: TUTOR_PERSONALIZATION_DISCLOSURE_VERSION,
        },
        ctx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_INVALID_INPUT' },
    })

    deploy('none')
    await expect(
      updateParticipantTutorPersonalizationChoice(
        {
          consent: true,
          expectedRevision: 1,
          disclosureVersion: TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION,
        },
        ctx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_INVALID_INPUT' },
    })
    // A refusal is never held back by the notice version.
    await expect(
      updateParticipantTutorPersonalizationChoice(
        {
          consent: false,
          expectedRevision: 1,
          disclosureVersion: TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION,
        },
        ctx
      )
    ).resolves.toMatchObject({ tutorPersonalizationConsent: false })
  })

  // Each row is one change of the choice. The memory epoch rises, and a
  // request to delete every note is written, exactly when a yes that covered
  // learning notes is replaced by anything else.
  it.each<{
    label: string
    from: Array<[Deployment, Answer]>
    change: [Deployment, Answer]
    notesConsentEnds: boolean
  }>([
    {
      label: 'a first yes to notes',
      from: [],
      change: ['memory', 'yes'],
      notesConsentEnds: false,
    },
    {
      label: 'a first no',
      from: [],
      change: ['memory', 'no'],
      notesConsentEnds: false,
    },
    {
      label: 'a no after a yes to notes',
      from: [['memory', 'yes']],
      change: ['memory', 'no'],
      notesConsentEnds: true,
    },
    {
      label: 'a yes to results only after a yes to notes',
      from: [['memory', 'yes']],
      change: ['key-only', 'yes'],
      notesConsentEnds: true,
    },
    {
      label: 'a no after a yes to results only',
      from: [['none', 'yes']],
      change: ['memory', 'no'],
      notesConsentEnds: false,
    },
    {
      label: 'a yes to notes after a yes to results only',
      from: [['none', 'yes']],
      change: ['memory', 'yes'],
      notesConsentEnds: false,
    },
    {
      label: 'a yes to notes after a no',
      from: [['memory', 'no']],
      change: ['memory', 'yes'],
      notesConsentEnds: false,
    },
  ])('$label', async ({ from, change, notesConsentEnds }) => {
    const participant = await createCompletedParticipant(randomUUID())
    for (const [deployment, consent] of from) {
      await answer(participant.id, deployment, consent)
    }
    const before = await readEpoch(participant.id)
    expect(await readForgetRequests(participant.id)).toEqual([])

    await answer(participant.id, change[0], change[1])

    const after = await readEpoch(participant.id)
    expect(after.learnerMemoryEpoch - before.learnerMemoryEpoch).toBe(
      notesConsentEnds ? 1 : 0
    )
    expect(await readForgetRequests(participant.id)).toEqual(
      notesConsentEnds
        ? [
            {
              courseId: null,
              epoch: after.learnerMemoryEpoch,
              completedAt: null,
            },
          ]
        : []
    )
  })

  it('raises the epoch again when a renewed yes to notes is withdrawn', async () => {
    const participant = await createCompletedParticipant('renewed')
    for (const consent of ['yes', 'no', 'yes', 'no'] as const) {
      await answer(participant.id, 'memory', consent)
    }
    expect((await readEpoch(participant.id)).learnerMemoryEpoch).toBe(2)
    expect(
      (await readForgetRequests(participant.id)).map((row) => row.epoch)
    ).toEqual([1, 2])
  })

  it('never holds back a withdrawal when the key secret is gone', async () => {
    const participant = await createCompletedParticipant('no-secret')
    await answer(participant.id, 'memory', 'yes')

    await expect(answer(participant.id, 'none', 'no')).resolves.toMatchObject({
      tutorPersonalizationConsent: false,
    })

    // The epoch still rises, so notes written before can never be used again.
    expect((await readEpoch(participant.id)).learnerMemoryEpoch).toBe(1)
    expect(await readForgetRequests(participant.id)).toEqual([])
  })

  it('leaves a deletion request behind when an account with notes is deleted', async () => {
    const withNotes = await createCompletedParticipant('delete-with-notes')
    const withoutNotes = await createCompletedParticipant('delete-without')
    await answer(withNotes.id, 'memory', 'yes')
    await answer(withoutNotes.id, 'memory', 'no')
    deploy('memory')

    await expect(
      deleteParticipantAccount(contextFor(withNotes.id))
    ).resolves.toBe(true)
    await expect(
      deleteParticipantAccount(contextFor(withoutNotes.id))
    ).resolves.toBe(true)

    expect(
      await prisma.participant.count({
        where: { id: { in: [withNotes.id, withoutNotes.id] } },
      })
    ).toBe(0)
    // One above the account's last epoch, so a note still being written for
    // the deleted account is refused by the service.
    expect(await readForgetRequests(withNotes.id)).toEqual([
      { courseId: null, epoch: 1, completedAt: null },
    ])
    expect(await readForgetRequests(withoutNotes.id)).toEqual([])
  })

  it('deletes an account without learner memory configured', async () => {
    const participant = await createCompletedParticipant('delete-unconfigured')
    await answer(participant.id, 'none', 'yes')
    deploy('none')

    await expect(
      deleteParticipantAccount(contextFor(participant.id))
    ).resolves.toBe(true)
    expect(
      await prisma.participant.count({ where: { id: participant.id } })
    ).toBe(0)
  })
})
