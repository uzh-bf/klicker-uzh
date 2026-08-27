import { prisma } from '@klicker-uzh/prisma'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { PRODUCT_UPDATES } from '@klicker-uzh/product-updates'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  dismissProductUpdate,
  getProductUpdateStates,
  markProductUpdateRead,
  recordProductUpdatePresentation,
} from '../src/services/productUpdates.js'

// The catalog is append-only and newest first, so the first entry stays a valid
// id even as new releases are announced.
const UPDATE_ID = PRODUCT_UPDATES[0]!.id
const UNKNOWN_UPDATE_ID = 'not-a-catalog-entry'

const TEST_PREFIX = `product-update-test-${Date.now()}`
const fixtureIds: { participantIds: string[]; userIds: string[] } = {
  participantIds: [],
  userIds: [],
}

function actorContext(
  id: string,
  role: UserRole,
  scope: UserLoginScope = UserLoginScope.ACCOUNT_OWNER
): ContextWithUser {
  return {
    prisma,
    user: {
      sub: id,
      role,
      scope,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

async function createLecturer() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const lecturer = await prisma.user.create({
    data: {
      shortname: `${TEST_PREFIX}-${suffix}`.slice(0, 60),
      email: `${TEST_PREFIX}-${suffix}@example.org`,
      name: 'Product Update Lecturer',
    },
  })
  fixtureIds.userIds.push(lecturer.id)

  return lecturer
}

async function createParticipant() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${suffix}`.slice(0, 60),
      // These fixtures never log in; the column only needs a value.
      password: `${TEST_PREFIX}-${suffix}`,
    },
  })
  fixtureIds.participantIds.push(participant.id)

  return participant
}

async function cleanupFixtures() {
  await prisma.participant.deleteMany({
    where: { id: { in: fixtureIds.participantIds.splice(0) } },
  })
  await prisma.user.deleteMany({
    where: { id: { in: fixtureIds.userIds.splice(0) } },
  })
}

describe('product update read state services', () => {
  afterEach(cleanupFixtures)
  afterAll(async () => prisma.$disconnect())

  it('creates a lecturer row on first presentation and increments the count afterwards', async () => {
    const lecturer = await createLecturer()
    const ctx = actorContext(lecturer.id, UserRole.USER)

    const first = await recordProductUpdatePresentation(
      { updateId: UPDATE_ID },
      ctx
    )
    expect(first.presentationCount).toBe(1)
    expect(first.readAt).toBeNull()
    expect(first.dismissedAt).toBeNull()

    const second = await recordProductUpdatePresentation(
      { updateId: UPDATE_ID },
      ctx
    )
    expect(second.presentationCount).toBe(2)
    expect(second.firstPresentedAt.getTime()).toBe(
      first.firstPresentedAt.getTime()
    )
    expect(second.lastPresentedAt.getTime()).toBeGreaterThanOrEqual(
      first.lastPresentedAt.getTime()
    )
  })

  it('writes participant presentations to the participant table', async () => {
    const participant = await createParticipant()
    const ctx = actorContext(participant.id, UserRole.PARTICIPANT)

    await recordProductUpdatePresentation({ updateId: UPDATE_ID }, ctx)

    await expect(
      prisma.participantProductUpdateState.count({
        where: { participantId: participant.id },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.userProductUpdateState.count({
        where: { updateId: UPDATE_ID, userId: participant.id },
      })
    ).resolves.toBe(0)
  })

  it('keeps the first read timestamp when the same entry is read again', async () => {
    const lecturer = await createLecturer()
    const ctx = actorContext(lecturer.id, UserRole.USER)

    const firstRead = await markProductUpdateRead({ updateId: UPDATE_ID }, ctx)
    expect(firstRead.readAt).not.toBeNull()

    const secondRead = await markProductUpdateRead({ updateId: UPDATE_ID }, ctx)
    expect(secondRead.readAt?.getTime()).toBe(firstRead.readAt?.getTime())
    expect(secondRead.id).toBe(firstRead.id)
  })

  it('records a dismissal and reports it back through the state query', async () => {
    const participant = await createParticipant()
    const ctx = actorContext(participant.id, UserRole.PARTICIPANT)

    const dismissed = await dismissProductUpdate({ updateId: UPDATE_ID }, ctx)
    expect(dismissed.dismissedAt).not.toBeNull()

    const states = await getProductUpdateStates({ updateIds: [UPDATE_ID] }, ctx)
    expect(states).toHaveLength(1)
    expect(states[0]!.dismissedAt?.getTime()).toBe(
      dismissed.dismissedAt?.getTime()
    )
  })

  it('returns no state for an entry the actor has never seen', async () => {
    const lecturer = await createLecturer()

    await expect(
      getProductUpdateStates(
        { updateIds: [UPDATE_ID] },
        actorContext(lecturer.id, UserRole.USER)
      )
    ).resolves.toEqual([])
  })

  it('never lets one actor mutate or read another actor state', async () => {
    const lecturerA = await createLecturer()
    const lecturerB = await createLecturer()

    await recordProductUpdatePresentation(
      { updateId: UPDATE_ID },
      actorContext(lecturerA.id, UserRole.USER)
    )
    await markProductUpdateRead(
      { updateId: UPDATE_ID },
      actorContext(lecturerA.id, UserRole.USER)
    )

    await expect(
      getProductUpdateStates(
        { updateIds: [UPDATE_ID] },
        actorContext(lecturerB.id, UserRole.USER)
      )
    ).resolves.toEqual([])

    const dismissedByB = await dismissProductUpdate(
      { updateId: UPDATE_ID },
      actorContext(lecturerB.id, UserRole.USER)
    )
    expect(dismissedByB.presentationCount).toBe(0)

    const stateOfA = await prisma.userProductUpdateState.findUniqueOrThrow({
      where: { userId_updateId: { userId: lecturerA.id, updateId: UPDATE_ID } },
    })
    expect(stateOfA.dismissedAt).toBeNull()
    expect(stateOfA.presentationCount).toBe(1)
  })

  it('rejects temporary participants on every operation', async () => {
    const participant = await createParticipant()
    const ctx = actorContext(participant.id, UserRole.TEMPORARY_PARTICIPANT)

    await expect(
      getProductUpdateStates({ updateIds: [UPDATE_ID] }, ctx)
    ).rejects.toThrow('This account type does not receive product updates')
    await expect(
      markProductUpdateRead({ updateId: UPDATE_ID }, ctx)
    ).rejects.toThrow('This account type does not receive product updates')
    await expect(
      dismissProductUpdate({ updateId: UPDATE_ID }, ctx)
    ).rejects.toThrow('This account type does not receive product updates')
    await expect(
      recordProductUpdatePresentation({ updateId: UPDATE_ID }, ctx)
    ).rejects.toThrow('This account type does not receive product updates')

    await expect(
      prisma.participantProductUpdateState.count({
        where: { participantId: participant.id },
      })
    ).resolves.toBe(0)
  })

  it('lets a delegated lecturer login below full access read but not write', async () => {
    const lecturer = await createLecturer()

    for (const scope of [
      UserLoginScope.READ_ONLY,
      UserLoginScope.SESSION_EXEC,
    ]) {
      const ctx = actorContext(lecturer.id, UserRole.USER, scope)

      await expect(
        markProductUpdateRead({ updateId: UPDATE_ID }, ctx)
      ).rejects.toThrow(
        'This login is not allowed to change product update state'
      )
      await expect(
        dismissProductUpdate({ updateId: UPDATE_ID }, ctx)
      ).rejects.toThrow(
        'This login is not allowed to change product update state'
      )
      await expect(
        recordProductUpdatePresentation({ updateId: UPDATE_ID }, ctx)
      ).rejects.toThrow(
        'This login is not allowed to change product update state'
      )

      // The feed still renders for a read-only login, so the query stays open.
      await expect(
        getProductUpdateStates({ updateIds: [UPDATE_ID] }, ctx)
      ).resolves.toEqual([])
    }

    await expect(
      prisma.userProductUpdateState.count({ where: { userId: lecturer.id } })
    ).resolves.toBe(0)
  })

  it('rejects an update id that is not in the catalog', async () => {
    const lecturer = await createLecturer()
    const ctx = actorContext(lecturer.id, UserRole.USER)

    await expect(
      markProductUpdateRead({ updateId: UNKNOWN_UPDATE_ID }, ctx)
    ).rejects.toThrow(`Unknown product update id(s): ${UNKNOWN_UPDATE_ID}`)
    await expect(
      dismissProductUpdate({ updateId: UNKNOWN_UPDATE_ID }, ctx)
    ).rejects.toThrow(`Unknown product update id(s): ${UNKNOWN_UPDATE_ID}`)
    await expect(
      recordProductUpdatePresentation({ updateId: UNKNOWN_UPDATE_ID }, ctx)
    ).rejects.toThrow(`Unknown product update id(s): ${UNKNOWN_UPDATE_ID}`)
    await expect(
      getProductUpdateStates({ updateIds: [UPDATE_ID, UNKNOWN_UPDATE_ID] }, ctx)
    ).rejects.toThrow(`Unknown product update id(s): ${UNKNOWN_UPDATE_ID}`)

    await expect(
      prisma.userProductUpdateState.count({ where: { userId: lecturer.id } })
    ).resolves.toBe(0)
  })
})
