import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  LeaderboardType,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { signJWT } from '@klicker-uzh/util'
import { createYoga } from 'graphql-yoga'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import {
  createParticipantAccount,
  loginParticipantWithLti,
} from '../src/services/accounts.js'
import {
  joinCourseLeaderboard,
  joinCourseWithPin,
} from '../src/services/courses.js'

vi.mock('../src/services/email.js', () => ({
  hydrateTemplate: vi.fn().mockResolvedValue('<p>Activation</p>'),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/notifications.js', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../src/services/notifications.js')
  >()),
  sendTeamsNotification: vi.fn().mockResolvedValue(undefined),
}))

const ownerId = randomUUID()
const courseId = randomUUID()
const assessmentCourseId = randomUUID()
const participantIds: string[] = []
let pin: number

function context(participantId?: string): Context {
  return {
    prisma,
    req: { locals: {} },
    res: { cookie: vi.fn() },
    emitter: new EventEmitter(),
    user: participantId
      ? { sub: participantId, role: UserRole.PARTICIPANT }
      : undefined,
  } as unknown as Context
}

async function participant() {
  const id = randomUUID()
  participantIds.push(id)
  return prisma.participant.create({
    data: {
      id,
      username: id,
      email: `${id}@example.com`,
      password: 'synthetic-unused',
    },
  })
}

async function executeJoin(ctx: Context) {
  const yoga = createYoga({ schema, context: () => ctx })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        'mutation($courseId:String!){joinCourseLeaderboard(courseId:$courseId){id}}',
      variables: { courseId },
    }),
  })
  return response.json()
}

describe('course enrollment authorization', () => {
  beforeAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.user.create({
      data: {
        id: ownerId,
        shortname: ownerId,
        email: `${ownerId}@example.com`,
      },
    })
    pin = Math.floor(Math.random() * 900000000) + 100000000
    for (const [id, isAssessmentEnabled] of [
      [courseId, false],
      [assessmentCourseId, true],
    ] as const) {
      await prisma.course.create({
        data: {
          id,
          ownerId,
          name: 'Synthetic enrollment course',
          displayName: 'Enrollment test',
          pinCode: isAssessmentEnabled ? null : pin,
          authType: isAssessmentEnabled
            ? CourseAuthType.SSO
            : CourseAuthType.PIN,
          isAssessmentEnabled,
          startDate: new Date(),
          endDate: new Date(),
          groupDeadlineDate: new Date(),
        },
      })
    }
  })

  afterAll(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.course.deleteMany({
      where: { id: { in: [courseId, assessmentCourseId] } },
    })
    await prisma.participant.deleteMany({
      where: { id: { in: participantIds } },
    })
    await prisma.user.deleteMany({ where: { id: ownerId } })
  })

  it('rejects anonymous and lecturer leaderboard requests', async () => {
    for (const ctx of [
      context(),
      {
        ...context(ownerId),
        user: { sub: ownerId, role: UserRole.USER },
      } as Context,
    ]) {
      expect((await executeJoin(ctx)).errors).toBeDefined()
    }
  })

  it('does not enroll an authenticated non-member through the GraphQL leaderboard mutation', async () => {
    const user = await participant()
    const result = await executeJoin(context(user.id))
    expect(result.errors).toBeUndefined()
    expect(result.data.joinCourseLeaderboard).toBeNull()
    expect(
      await prisma.participation.count({ where: { participantId: user.id } })
    ).toBe(0)
    expect(
      await prisma.leaderboardEntry.count({ where: { participantId: user.id } })
    ).toBe(0)
  })

  it('allows PIN enrollment and repeated leaderboard opt-in without replacing membership or scores', async () => {
    const user = await participant()
    const ctx = context(user.id) as ContextWithUser
    expect(await joinCourseWithPin({ pin: 0 }, ctx)).toBeNull()
    expect(await joinCourseWithPin({ pin: pin + 1 }, ctx)).toBeNull()
    expect(
      await prisma.participation.count({ where: { participantId: user.id } })
    ).toBe(0)
    expect(await joinCourseWithPin({ pin }, ctx)).not.toBeNull()
    const membership = await prisma.participation.findUniqueOrThrow({
      where: { courseId_participantId: { courseId, participantId: user.id } },
    })
    expect(membership.isActive).toBe(false)
    await joinCourseLeaderboard({ courseId }, ctx)
    await prisma.leaderboardEntry.update({
      where: {
        type_participantId_courseId: {
          type: LeaderboardType.COURSE,
          courseId,
          participantId: user.id,
        },
      },
      data: { score: 42 },
    })
    await joinCourseLeaderboard({ courseId }, ctx)
    expect(
      await prisma.participation.findUnique({ where: { id: membership.id } })
    ).toMatchObject({ isActive: true })
    expect(
      await prisma.participation.count({
        where: { participantId: user.id, courseId },
      })
    ).toBe(1)
    expect(
      await prisma.leaderboardEntry.findFirst({
        where: { participantId: user.id, courseId },
      })
    ).toMatchObject({ score: 42 })
  })

  it('creates an ordinary account without enrolling from a supplied course ID, then permits PIN enrollment', async () => {
    const username = randomUUID().slice(0, 15)
    const email = `${randomUUID()}@example.com`
    const result = await createParticipantAccount(
      {
        username,
        email,
        password: 'synthetic-password',
        isProfilePublic: false,
        courseId,
      },
      context()
    )
    const created = await prisma.participant.findUniqueOrThrow({
      where: { username },
    })
    participantIds.push(created.id)
    expect(result?.participant.id).toBe(created.id)
    expect(
      await prisma.participation.count({ where: { participantId: created.id } })
    ).toBe(0)
    expect(
      await joinCourseLeaderboard(
        { courseId },
        context(created.id) as ContextWithUser
      )
    ).toBeNull()
    expect(
      await joinCourseWithPin({ pin }, context(created.id) as ContextWithUser)
    ).not.toBeNull()
  })

  it('preserves LTI membership and leaderboard state, while rejecting assessment enrollment and invalid handoffs', async () => {
    const user = await participant()
    const signedLtiData = await signJWT(
      { sub: randomUUID(), email: user.email!, scope: 'LTI1.3' },
      process.env.APP_SECRET!,
      { expiresIn: '5m' }
    )
    expect(
      await loginParticipantWithLti(
        { signedLtiData, courseId: assessmentCourseId },
        context()
      )
    ).toBeNull()
    expect(
      await createParticipantAccount(
        {
          signedLtiData,
          courseId: assessmentCourseId,
          email: user.email!,
          username: 'assessment-test',
          password: 'synthetic-password',
          isProfilePublic: false,
        },
        context()
      )
    ).toBeNull()
    await expect(
      loginParticipantWithLti({ signedLtiData: 'invalid', courseId }, context())
    ).rejects.toThrow()
    expect(
      await prisma.participation.count({ where: { participantId: user.id } })
    ).toBe(0)
    await loginParticipantWithLti({ signedLtiData, courseId }, context())
    await joinCourseLeaderboard(
      { courseId },
      context(user.id) as ContextWithUser
    )
    await prisma.leaderboardEntry.update({
      where: {
        type_participantId_courseId: {
          type: LeaderboardType.COURSE,
          courseId,
          participantId: user.id,
        },
      },
      data: { score: 27 },
    })
    await loginParticipantWithLti({ signedLtiData, courseId }, context())
    expect(
      await prisma.participation.count({
        where: { participantId: user.id, courseId },
      })
    ).toBe(1)
    expect(
      await prisma.participation.findFirst({
        where: { participantId: user.id, courseId },
      })
    ).toMatchObject({ isActive: true })
    expect(
      await prisma.leaderboardEntry.findFirst({
        where: { participantId: user.id, courseId },
      })
    ).toMatchObject({ score: 27 })
  })
})
