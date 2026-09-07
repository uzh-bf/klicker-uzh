import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { prisma } from '@klicker-uzh/prisma'
import { UserRole } from '@klicker-uzh/prisma/client'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { refreshParticipantGroupScores } from '../src/lib/groupScores.js'
import {
  getStudentCourseLeaderboard,
  joinCourseLeaderboard,
  leaveCourseLeaderboard,
} from '../src/services/courses.js'
import {
  getParticipantGroups,
  joinParticipantGroup,
  leaveParticipantGroup,
} from '../src/services/groups.js'
import {
  endLiveQuiz,
  getLiveQuizLeaderboard,
} from '../src/services/liveQuizzes.js'
import { respondToQuestion } from '../src/services/stacks.js'

const ownerId = randomUUID()
const participantId = randomUUID()
const groupPeerId = randomUUID()
const courseId = randomUUID()

vi.mock('@klicker-uzh/util', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@klicker-uzh/util')>()),
  sendTeamsNotification: vi.fn(),
}))

const ctx = {
  prisma,
  user: { sub: participantId, role: UserRole.PARTICIPANT },
  emitter: new EventEmitter(),
} as ContextWithUser

describe('leaderboard publication retains private balances', () => {
  afterAll(async () => {
    await prisma.course.deleteMany({ where: { id: courseId } })
    await prisma.participant.deleteMany({
      where: { id: { in: [participantId, groupPeerId] } },
    })
    await prisma.user.deleteMany({ where: { id: ownerId } })
  })

  it('preserves course, session and timeline points through leave and rejoin', async () => {
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.invalid`,
        shortname: 'test',
      },
    })
    await prisma.participant.create({
      data: { id: participantId, username: participantId, password: 'unused' },
    })
    await prisma.course.create({
      data: {
        id: courseId,
        name: 'Synthetic retention test',
        displayName: 'Synthetic retention test',
        ownerId,
        authType: 'SSO',
        startDate: new Date(),
        endDate: new Date(),
        groupDeadlineDate: new Date(),
      },
    })
    const participation = await prisma.participation.create({
      data: { participantId, courseId, isActive: false },
    })
    const quiz = await prisma.liveQuiz.create({
      data: {
        name: 'Synthetic retention quiz',
        displayName: 'Synthetic retention quiz',
        ownerId,
        courseId,
        isGamificationEnabled: true,
      },
    })
    const courseEntry = await prisma.leaderboardEntry.create({
      data: {
        type: 'COURSE',
        participantId,
        courseId,
        score: 125,
        participation: { connect: { id: participation.id } },
      },
    })
    const sessionEntry = await prisma.leaderboardEntry.create({
      data: {
        type: 'SESSION',
        participantId,
        liveQuizId: quiz.id,
        score: 25,
        sessionParticipationId: participation.id,
      },
    })
    const timeline = await prisma.timelineEntry.create({
      data: {
        type: 'DAILY',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        participationId: participation.id,
        courseId,
        collectedPoints: 125,
        collectedXp: 30,
      },
    })

    await prisma.participant.create({
      data: { id: groupPeerId, username: groupPeerId, password: 'unused' },
    })
    const peerParticipation = await prisma.participation.create({
      data: { participantId: groupPeerId, courseId, isActive: true },
    })
    await prisma.leaderboardEntry.create({
      data: {
        type: 'COURSE',
        participantId: groupPeerId,
        courseId,
        score: 75,
        participation: { connect: { id: peerParticipation.id } },
      },
    })
    const group = await prisma.participantGroup.create({
      data: {
        name: 'Synthetic group',
        code: 123456,
        courseId,
        groupActivityScore: 20,
        averageMemberScore: 100,
        participants: { connect: [{ id: participantId }, { id: groupPeerId }] },
      },
    })
    const refreshGroup = () =>
      prisma.$transaction((tx) =>
        refreshParticipantGroupScores(tx, { id: group.id })
      )
    const groupState = () =>
      prisma.participantGroup.findUniqueOrThrow({ where: { id: group.id } })
    await refreshGroup()
    expect(await groupState()).toMatchObject({
      averageMemberScore: 100,
      groupActivityScore: 20,
    })
    const publicGroups = await getParticipantGroups(
      { courseId },
      { ...ctx, user: { ...ctx.user, sub: groupPeerId } }
    )
    expect(
      publicGroups[0]?.participants.find(
        (member) => member.id === participantId
      )?.score
    ).toBe(0)

    const publicCourse = () =>
      getStudentCourseLeaderboard({ courseId, mode: 'course' }, ctx)
    const publicSession = () => getLiveQuizLeaderboard({ quizId: quiz.id }, ctx)
    expect(
      (await publicCourse()).leaderboard.some(
        (entry) => entry.participantId === participantId
      )
    ).toBe(false)
    expect(await publicSession()).toEqual([])

    const joined = await joinCourseLeaderboard({ courseId }, ctx)
    expect(joined?.lbEntry.score).toBe(125)
    expect(await groupState()).toMatchObject({
      averageMemberScore: 100,
      groupActivityScore: 20,
    })
    expect((await publicCourse()).leaderboard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ participantId, score: 125 }),
      ])
    )
    expect(await publicSession()).toEqual([
      expect.objectContaining({ participantId, score: 25 }),
    ])

    await leaveCourseLeaderboard({ courseId }, ctx)
    await leaveCourseLeaderboard({ courseId }, ctx)
    expect(await groupState()).toMatchObject({
      averageMemberScore: 100,
      groupActivityScore: 20,
    })
    await Promise.all([
      refreshGroup(),
      joinCourseLeaderboard({ courseId }, ctx),
    ])
    expect(await groupState()).toMatchObject({ averageMemberScore: 100 })
    await Promise.all([
      refreshGroup(),
      leaveCourseLeaderboard({ courseId }, ctx),
    ])
    expect(await groupState()).toMatchObject({ averageMemberScore: 100 })
    await leaveParticipantGroup({ groupId: group.id, courseId }, ctx)
    expect(await groupState()).toMatchObject({ averageMemberScore: 0 })
    await joinCourseLeaderboard({ courseId }, ctx)
    await Promise.all([
      joinParticipantGroup({ courseId, code: group.code }, ctx),
      leaveCourseLeaderboard({ courseId }, ctx),
    ])
    expect(await groupState()).toMatchObject({ averageMemberScore: 100 })
    const peerCtx = { ...ctx, user: { ...ctx.user, sub: groupPeerId } }
    await leaveCourseLeaderboard({ courseId }, peerCtx)
    expect(await groupState()).toMatchObject({
      averageMemberScore: 100,
      groupActivityScore: 20,
    })
    await joinCourseLeaderboard({ courseId }, peerCtx)
    expect(await groupState()).toMatchObject({ averageMemberScore: 100 })
    const failingPrisma = prisma.$extends({
      query: {
        leaderboardEntry: {
          async upsert() {
            throw new Error('Synthetic score storage failure')
          },
        },
      },
    })
    await expect(
      joinCourseLeaderboard({ courseId }, {
        ...ctx,
        prisma: failingPrisma,
      } as ContextWithUser)
    ).rejects.toThrow('Synthetic score storage failure')
    expect(
      await prisma.participation.findUnique({
        where: { id: participation.id },
      })
    ).toMatchObject({ isActive: false })
    expect(
      (await publicCourse()).leaderboard.some(
        (entry) => entry.participantId === participantId
      )
    ).toBe(false)
    expect(await publicSession()).toEqual([])
    expect(
      await prisma.leaderboardEntry.findUnique({
        where: { id: sessionEntry.id },
      })
    ).toEqual(sessionEntry)
    expect(
      await prisma.timelineEntry.findUnique({ where: { id: timeline.id } })
    ).toEqual(timeline)

    await Promise.all([
      joinCourseLeaderboard({ courseId }, ctx),
      prisma.leaderboardEntry.update({
        where: { id: courseEntry.id },
        data: { score: { increment: 15 } },
      }),
    ])
    const rejoined = await joinCourseLeaderboard({ courseId }, ctx)
    expect(rejoined?.lbEntry.score).toBe(140)
    await leaveCourseLeaderboard({ courseId }, ctx)
    const inactiveParticipation = await prisma.participation.findUniqueOrThrow({
      where: { id: participation.id },
      include: { participant: true },
    })
    const element = await prisma.element.create({
      data: {
        ownerId,
        name: 'Synthetic question',
        content: 'Select the correct option',
        type: 'SC',
        options: {
          hasSampleSolution: true,
          displayMode: 'LIST',
          choices: [
            { ix: 0, value: 'A', correct: true },
            { ix: 1, value: 'B', correct: false },
          ],
        },
      },
    })
    const instance = await prisma.elementInstance.create({
      data: {
        ownerId,
        elementId: element.id,
        type: 'PRACTICE_QUIZ',
        elementType: 'SC',
        order: 0,
        options: { resetTimeDays: 1 },
        elementData: {
          ...element,
          id: String(element.id),
          elementId: element.id,
        } as any,
        results: { choices: {}, total: 0 },
        anonymousResults: { choices: {}, total: 0 },
        instanceStatistics: { create: {} },
      },
    })
    const respond = () =>
      respondToQuestion(
        {
          id: instance.id,
          courseId,
          answerTime: 1000,
          participation: inactiveParticipation,
          response: {
            choices: [
              { ix: 0, selected: true },
              { ix: 1, selected: false },
            ],
          },
        },
        ctx
      )
    const responses = await Promise.all([respond(), respond()])
    const awarded = responses.map(
      (result) => result?.evaluation?.pointsAwarded ?? 0
    )
    expect(awarded.filter((points) => points > 0)).toHaveLength(1)
    const points = Math.max(...awarded)
    expect(points).toBeGreaterThan(0)
    expect(
      await prisma.timelineEntry.findFirst({
        where: { participationId: participation.id, id: { not: timeline.id } },
      })
    ).toMatchObject({ collectedPoints: points })
    expect(
      (await publicCourse()).leaderboard.some(
        (entry) => entry.participantId === participantId
      )
    ).toBe(false)
    expect(
      await prisma.leaderboardEntry.findUnique({
        where: { id: courseEntry.id },
      })
    ).toMatchObject({ score: 140 + points })
    const xpAfterFirst = (
      await prisma.participant.findUniqueOrThrow({
        where: { id: participantId },
      })
    ).xp
    expect(xpAfterFirst).toBeGreaterThan(0)
    await prisma.questionResponse.updateMany({
      where: { participantId, elementInstanceId: instance.id },
      data: { lastAwardedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    })
    expect((await respond())?.evaluation?.pointsAwarded).toBe(points)
    expect(
      (
        await prisma.participant.findUniqueOrThrow({
          where: { id: participantId },
        })
      ).xp
    ).toBe(xpAfterFirst)
    expect(
      (await joinCourseLeaderboard({ courseId }, ctx))?.lbEntry.score
    ).toBe(140 + 2 * points)
    await leaveCourseLeaderboard({ courseId }, ctx)
    await prisma.liveQuiz.update({
      where: { id: quiz.id },
      data: { status: 'PUBLISHED' },
    })
    const closingCtx = {
      ...ctx,
      redisExec: {
        hgetall: async (key: string) => ({
          [participantId]: key.endsWith(':lb') ? '25' : '5',
        }),
      },
    } as unknown as ContextWithUser
    await Promise.all([
      endLiveQuiz({ id: quiz.id }, closingCtx),
      endLiveQuiz({ id: quiz.id }, closingCtx),
    ])
    expect(
      (await joinCourseLeaderboard({ courseId }, ctx))?.lbEntry.score
    ).toBe(165 + 2 * points)
    await leaveCourseLeaderboard({ courseId }, ctx)
    await prisma.leaderboardEntry.delete({ where: { id: courseEntry.id } })
    await prisma.questionResponse.updateMany({
      where: { participantId, elementInstanceId: instance.id },
      data: { lastAwardedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    })
    await Promise.all([respond(), joinCourseLeaderboard({ courseId }, ctx)])
    expect(
      (await joinCourseLeaderboard({ courseId }, ctx))?.lbEntry.score
    ).toBe(points)
    expect(
      await prisma.awardEntry.count({ where: { participantId, courseId } })
    ).toBe(0)
    expect(
      await prisma.participantAchievementInstance.count({
        where: { participantId },
      })
    ).toBe(0)
  })
})
