import { prisma } from '@klicker-uzh/prisma'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import type { GraphQLObjectType } from 'graphql'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'

const fixtureIds = {
  instanceIds: [] as number[],
  participantIds: [] as string[],
}

function participantContext(participantId: string): ContextWithUser {
  return {
    prisma,
    user: {
      sub: participantId,
      role: UserRole.PARTICIPANT,
      scope: UserLoginScope.READ_ONLY,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser
}

function receiptResolver() {
  const type = schema.getType('ParticipantAchievementInstance') as
    | GraphQLObjectType
    | undefined
  if (!type) throw new Error('achievement_instance_type_missing')

  const resolver = type.getFields().receiptAcknowledgedAt?.resolve
  if (!resolver) throw new Error('receipt_resolver_missing')
  return resolver
}

function acknowledgementResolver() {
  const resolver = schema.getMutationType()?.getFields()
    .acknowledgeAchievementReceipt?.resolve
  if (!resolver) throw new Error('acknowledgement_resolver_missing')
  return resolver
}

async function createFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const [owner, other] = await Promise.all([
    prisma.participant.create({
      data: {
        username: `receipt-owner-${suffix}`,
        password: 'not-used',
      },
      select: { id: true },
    }),
    prisma.participant.create({
      data: {
        username: `receipt-other-${suffix}`,
        password: 'not-used',
      },
      select: { id: true },
    }),
  ])
  fixtureIds.participantIds.push(owner.id, other.id)

  const achievement = await prisma.achievement.findFirstOrThrow({
    select: { id: true },
  })

  const instance = await prisma.participantAchievementInstance.create({
    data: {
      participantId: owner.id,
      achievementId: achievement.id,
      achievedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    select: { id: true },
  })
  fixtureIds.instanceIds.push(instance.id)

  return { achievement, instance, owner, other }
}

async function cleanupFixtures() {
  await prisma.participantAchievementInstance.deleteMany({
    where: { id: { in: fixtureIds.instanceIds.splice(0) } },
  })
  await prisma.participant.deleteMany({
    where: { id: { in: fixtureIds.participantIds.splice(0) } },
  })
}

describe('achievement receipt privacy and acknowledgement', () => {
  afterEach(cleanupFixtures)
  afterAll(async () => prisma.$disconnect())

  it('only exposes receipt timestamps to the owning participant', async () => {
    const fixture = await createFixture()
    const acknowledgedAt = new Date('2026-01-02T00:00:00.000Z')

    await prisma.participantAchievementInstance.update({
      where: { id: fixture.instance.id },
      data: { receiptAcknowledgedAt: acknowledgedAt },
    })

    const instance =
      await prisma.participantAchievementInstance.findUniqueOrThrow({
        where: { id: fixture.instance.id },
      })
    const resolveReceipt = receiptResolver()

    expect(
      resolveReceipt(
        instance,
        {},
        participantContext(fixture.owner.id),
        undefined as never
      )
    ).toEqual(acknowledgedAt)
    expect(
      resolveReceipt(
        instance,
        {},
        participantContext(fixture.other.id),
        undefined as never
      )
    ).toBeNull()
  })

  it('acknowledges owned instances idempotently and rejects foreign or missing IDs', async () => {
    const fixture = await createFixture()

    const resolveAcknowledgement = acknowledgementResolver()
    const first = await resolveAcknowledgement(
      undefined,
      { achievementInstanceId: fixture.instance.id },
      participantContext(fixture.owner.id),
      undefined as never
    )
    expect(first).toBe(true)

    const afterFirst =
      await prisma.participantAchievementInstance.findUniqueOrThrow({
        where: { id: fixture.instance.id },
        select: { receiptAcknowledgedAt: true },
      })
    expect(afterFirst.receiptAcknowledgedAt).not.toBeNull()

    const repeated = await resolveAcknowledgement(
      undefined,
      { achievementInstanceId: fixture.instance.id },
      participantContext(fixture.owner.id),
      undefined as never
    )
    expect(repeated).toBe(true)

    const afterRepeated =
      await prisma.participantAchievementInstance.findUniqueOrThrow({
        where: { id: fixture.instance.id },
        select: { receiptAcknowledgedAt: true },
      })
    expect(afterRepeated.receiptAcknowledgedAt).toEqual(
      afterFirst.receiptAcknowledgedAt
    )

    const foreign = await resolveAcknowledgement(
      undefined,
      { achievementInstanceId: fixture.instance.id },
      participantContext(fixture.other.id),
      undefined as never
    )
    expect(foreign).toBe(false)

    const missing = await resolveAcknowledgement(
      undefined,
      { achievementInstanceId: -1 },
      participantContext(fixture.owner.id),
      undefined as never
    )
    expect(missing).toBe(false)
    await expect(
      prisma.participantAchievementInstance.findUniqueOrThrow({
        where: { id: fixture.instance.id },
        select: { receiptAcknowledgedAt: true },
      })
    ).resolves.toEqual(afterFirst)
  })
})
