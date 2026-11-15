import { scoreEscapeRoomAttempt } from '@klicker-uzh/grading'
import {
  ESCAPE_ROOM_GRACE_SECONDS,
  isEscapeRoomExpired,
} from '@klicker-uzh/types'
import { describe, expect, it, vi } from 'vitest'
import {
  getEscapeRoomLockoutRemainingSeconds,
  getGroupEscapeRoomSession,
  setEscapeRoomSessionPhase,
  skipEscapeRoomStage,
} from '../src/services/escapeRooms.js'
import {
  endGroupActivity,
  handleEndExpiredGroupActivity,
} from '../src/services/groups.js'
import {
  courseId,
  createCtx,
  DB,
  getEscapeRoomProgress,
  getEscapeRoomRemainingSeconds,
  getGroupActivityDetails,
  groupScResponse,
  lecturerCtx,
  participantCtx,
  prisma,
  recomputeDerivedPermissions,
  requestEscapeRoomHint,
  resetEscapeRoomAttempt,
  scElement,
  seedEscapeRoomGroupActivity,
  seedParticipant,
  startEscapeRoomAttempt,
  submitGroupActivityDecisions,
} from './escapeRoomTestHarness.js'

const Phase = DB.EscapeRoomSessionPhase
const NOT_RUNNING = { extensions: { code: 'ESCAPE_ROOM_SESSION_NOT_RUNNING' } }

let fixtureCounter = 0

async function seedSession(
  phase: DB.EscapeRoomSessionPhase | null,
  options: { timeLimit?: number } = {}
) {
  const suffix = `${fixtureCounter++}`
  const participantA = await seedParticipant(`session-a-${suffix}`)
  const participantB = await seedParticipant(`session-b-${suffix}`)
  const fixture = await seedEscapeRoomGroupActivity(
    {
      elements: [scElement, scElement],
      courseId,
      participantIds: [participantA.id, participantB.id],
      timeLimit: options.timeLimit,
      session: phase ? { phase } : undefined,
    },
    lecturerCtx
  )
  await recomputeDerivedPermissions(
    { groupActivityId: fixture.groupActivity.id, userId: lecturerCtx.user.sub },
    prisma
  )
  const instances = fixture.groupActivity.stacks[0]!.elements
  const ids = {
    groupActivityId: fixture.groupActivity.id,
    groupId: fixture.group.id,
  }
  return {
    ...fixture,
    instances,
    ids,
    memberCtx: participantCtx(participantA.id),
    answer: (index: number, selectedIx: 0 | 1 = 0) =>
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [groupScResponse(instances[index]!.id, selectedIx)],
        },
        participantCtx(participantA.id)
      ),
    attemptRow: () =>
      prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: { id: fixture.attempt.id },
      }),
    configRow: () =>
      prisma.escapeRoomConfig.findUniqueOrThrow({
        where: { groupActivityId: fixture.groupActivity.id },
      }),
  }
}

const secondsAgo = (seconds: number) => new Date(Date.now() - seconds * 1000)

describe.each([
  Phase.LOBBY,
  Phase.PAUSED,
  Phase.ENDED,
])('Group Activity session clock - %s phase rejects play', (phase) => {
  it('rejects an answer without changing the attempt', async () => {
    const fixture = await seedSession(phase)
    const before = await fixture.attemptRow()

    await expect(fixture.answer(0)).rejects.toMatchObject(NOT_RUNNING)

    expect(await fixture.attemptRow()).toEqual(before)
  })

  it('rejects starting or resuming an attempt', async () => {
    const fixture = await seedSession(phase)
    await expect(
      startEscapeRoomAttempt(fixture.ids, fixture.memberCtx)
    ).rejects.toMatchObject(NOT_RUNNING)

    await prisma.escapeRoomAttempt.delete({
      where: { id: fixture.attempt.id },
    })
    await expect(
      startEscapeRoomAttempt(fixture.ids, fixture.memberCtx)
    ).rejects.toMatchObject(NOT_RUNNING)
    expect(
      await prisma.escapeRoomAttempt.count({
        where: { groupActivityId: fixture.groupActivity.id },
      })
    ).toBe(0)
  })

  it('rejects a hint without charging its penalty', async () => {
    const fixture = await seedSession(phase)
    await prisma.elementInstance.update({
      where: { id: fixture.instances[0]!.id },
      data: { options: { escapeRoomHint: 'Look closer' } },
    })

    await expect(
      requestEscapeRoomHint(
        { ...fixture.ids, instanceId: fixture.instances[0]!.id },
        fixture.memberCtx
      )
    ).rejects.toMatchObject(NOT_RUNNING)

    const attempt = await fixture.attemptRow()
    expect(attempt.penaltySeconds).toBe(0)
    expect(attempt.hintsUsed).toEqual([])
  })

  it('rejects a skip without charging its penalty', async () => {
    const fixture = await seedSession(phase)
    await prisma.escapeRoomConfig.update({
      where: { groupActivityId: fixture.groupActivity.id },
      data: { skipPenalty: 10 },
    })

    await expect(
      skipEscapeRoomStage(fixture.ids, fixture.memberCtx)
    ).rejects.toMatchObject(NOT_RUNNING)

    const attempt = await fixture.attemptRow()
    expect(attempt.penaltySeconds).toBe(0)
    expect(attempt.stageResponses).toEqual([])
  })
})

describe('Group Activity session clock - bonus answers', () => {
  async function seedCompletedWithBonus(
    phase: DB.EscapeRoomSessionPhase,
    pauses: Array<{ startedAt: Date; endedAt: Date }> = []
  ) {
    const fixture = await seedSession(phase, { timeLimit: 600 })
    await prisma.escapeRoomConfig.update({
      where: { groupActivityId: fixture.groupActivity.id },
      data: {
        bonusSeconds: 30,
        sessionPauses: pauses.map((pause) => ({
          startedAt: pause.startedAt.toISOString(),
          endedAt: pause.endedAt.toISOString(),
        })),
      },
    })
    await prisma.escapeRoomAttempt.update({
      where: { id: fixture.attempt.id },
      data: {
        // 20 seconds past the wall-clock deadline
        startedAt: secondsAgo(600 + ESCAPE_ROOM_GRACE_SECONDS + 20),
        status: DB.EscapeRoomStatus.COMPLETED,
        completedAt: secondsAgo(60),
        stageResponses: [
          {
            instanceId: fixture.instances[0]!.id,
            response: null,
            clearedAt: secondsAgo(60).toISOString(),
            outcome: 'SOLVED',
          },
        ],
      },
    })
    return fixture
  }

  it.each([
    Phase.PAUSED,
    Phase.ENDED,
  ])('rejects the bonus answer while the session is %s', async (phase) => {
    const fixture = await seedCompletedWithBonus(phase)
    await expect(fixture.answer(1)).rejects.toMatchObject(NOT_RUNNING)
    expect(
      (await fixture.attemptRow()).stageResponses as unknown[]
    ).toHaveLength(1)
  })

  it('keeps the bonus window open for the length of a pause', async () => {
    const fixture = await seedCompletedWithBonus(Phase.RUNNING, [
      { startedAt: secondsAgo(300), endedAt: secondsAgo(200) },
    ])
    await expect(fixture.answer(1)).resolves.toBe(fixture.activityInstance.id)
    expect(
      (await fixture.attemptRow()).stageResponses as unknown[]
    ).toHaveLength(2)
  })

  it('closes the bonus window at the wall-clock deadline without a pause', async () => {
    const fixture = await seedCompletedWithBonus(Phase.RUNNING)
    await expect(fixture.answer(1)).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_EXPIRED' },
    })
  })
})

describe('setEscapeRoomSessionPhase', () => {
  const move = (
    fixture: Awaited<ReturnType<typeof seedSession>>,
    phase: DB.EscapeRoomSessionPhase
  ) =>
    setEscapeRoomSessionPhase(
      { groupActivityId: fixture.groupActivity.id, phase },
      lecturerCtx
    )

  it('walks lobby, running, paused, running and ended', async () => {
    const fixture = await seedSession(Phase.LOBBY)

    const running = await move(fixture, Phase.RUNNING)
    expect(running.sessionPhase).toBe(Phase.RUNNING)
    expect(running.sessionStartedAt).not.toBeNull()

    const paused = await move(fixture, Phase.PAUSED)
    expect(paused.sessionPausedAt).not.toBeNull()

    const resumed = await move(fixture, Phase.RUNNING)
    expect(resumed.sessionPausedAt).toBeNull()
    expect(resumed.sessionPauses).toHaveLength(1)

    const ended = await move(fixture, Phase.ENDED)
    expect(ended.sessionEndedAt).not.toBeNull()
  })

  it.each([
    [Phase.LOBBY, Phase.PAUSED],
    [Phase.LOBBY, Phase.ENDED],
    [Phase.LOBBY, Phase.LOBBY],
    [Phase.RUNNING, Phase.RUNNING],
    [Phase.RUNNING, Phase.LOBBY],
    [Phase.PAUSED, Phase.PAUSED],
    [Phase.ENDED, Phase.RUNNING],
    [Phase.ENDED, Phase.ENDED],
  ])('rejects the move from %s to %s', async (from, to) => {
    const fixture = await seedSession(from)
    await expect(move(fixture, to)).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_SESSION_TRANSITION' },
    })
    expect((await fixture.configRow()).sessionPhase).toBe(from)
  })

  it('applies a repeated or concurrent move only once', async () => {
    const fixture = await seedSession(Phase.LOBBY)
    const results = await Promise.allSettled([
      move(fixture, Phase.RUNNING),
      move(fixture, Phase.RUNNING),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await fixture.configRow()).sessionPhase).toBe(Phase.RUNNING)

    await expect(move(fixture, Phase.RUNNING)).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_SESSION_TRANSITION' },
    })
  })

  it('refuses to run outside the published window', async () => {
    const outside = await seedSession(Phase.LOBBY)
    await prisma.groupActivity.update({
      where: { id: outside.groupActivity.id },
      data: { scheduledEndAt: secondsAgo(10) },
    })
    await expect(move(outside, Phase.RUNNING)).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_SESSION_OUTSIDE_WINDOW' },
    })

    const unpublished = await seedSession(Phase.LOBBY)
    await prisma.groupActivity.update({
      where: { id: unpublished.groupActivity.id },
      data: { status: DB.PublicationStatus.ENDED },
    })
    await expect(move(unpublished, Phase.RUNNING)).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_SESSION_OUTSIDE_WINDOW' },
    })
    expect((await unpublished.configRow()).sessionPhase).toBe(Phase.LOBBY)
  })

  it('refuses a move when the session clock is off', async () => {
    const fixture = await seedSession(null)
    await expect(move(fixture, Phase.RUNNING)).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_SESSION_DISABLED' },
    })
  })

  it('expires running attempts when the session ends', async () => {
    const fixture = await seedSession(Phase.RUNNING)
    await move(fixture, Phase.ENDED)
    expect((await fixture.attemptRow()).status).toBe(
      DB.EscapeRoomStatus.EXPIRED
    )
  })

  it('ends a paused session and keeps its attempts finalized', async () => {
    const fixture = await seedSession(Phase.RUNNING)
    await move(fixture, Phase.PAUSED)
    await move(fixture, Phase.ENDED)
    expect((await fixture.attemptRow()).status).toBe(
      DB.EscapeRoomStatus.EXPIRED
    )
    expect((await fixture.configRow()).sessionPhase).toBe(Phase.ENDED)
  })
})

describe('Group Activity session clock - pauses', () => {
  it('adds the pause to remaining time and lockout but not to ranked time', async () => {
    const fixture = await seedSession(Phase.RUNNING, { timeLimit: 3600 })
    const lockoutUntil = new Date(Date.now() + 30_000)
    await prisma.escapeRoomAttempt.update({
      where: { id: fixture.attempt.id },
      data: {
        startedAt: secondsAgo(120),
        lockoutUntil,
        stageResponses: [
          {
            instanceId: fixture.instances[0]!.id,
            response: null,
            clearedAt: secondsAgo(20).toISOString(),
            outcome: 'SOLVED',
          },
        ],
      },
    })

    await setEscapeRoomSessionPhase(
      { groupActivityId: fixture.groupActivity.id, phase: Phase.PAUSED },
      lecturerCtx
    )
    // A 60-second pause: move its start back instead of waiting.
    await prisma.escapeRoomConfig.update({
      where: { groupActivityId: fixture.groupActivity.id },
      data: { sessionPausedAt: secondsAgo(60) },
    })
    await setEscapeRoomSessionPhase(
      { groupActivityId: fixture.groupActivity.id, phase: Phase.RUNNING },
      lecturerCtx
    )

    const attempt = await fixture.attemptRow()
    const config = await fixture.configRow()
    const session = getGroupEscapeRoomSession(config)

    // 120 s on the wall clock, of which 60 s were paused.
    expect(
      Math.abs(
        getEscapeRoomRemainingSeconds(attempt, undefined, session) - 3540
      )
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(getEscapeRoomRemainingSeconds(attempt) - 3480)
    ).toBeLessThanOrEqual(1)

    const shift = attempt.lockoutUntil!.getTime() - lockoutUntil.getTime()
    expect(Math.abs(shift - 60_000)).toBeLessThan(2_000)

    const progress = await getEscapeRoomProgress(
      { groupActivityId: fixture.groupActivity.id },
      lecturerCtx
    )
    const row = progress!.attempts.find(
      (entry) => entry.groupId === fixture.group.id
    )!
    // Cleared 100 s after the start; the pause covers the last 40 s of it.
    expect(Math.abs(row.rankedSeconds! - 60)).toBeLessThanOrEqual(1)
  })

  it('measures remaining time, ranked time and expiry across three attempt shapes', () => {
    const now = Date.now()
    const ago = (seconds: number) => new Date(now - seconds * 1000)
    const session = {
      sessionClock: true,
      sessionPauses: [
        {
          startedAt: ago(300).toISOString(),
          endedAt: ago(200).toISOString(),
        },
      ],
      sessionPausedAt: null,
    }
    const attempt = (startedAt: Date) => ({ startedAt, timeLimit: 1000 })
    const remaining = (startedAt: Date, withSession: boolean) =>
      getEscapeRoomRemainingSeconds(
        attempt(startedAt),
        now,
        withSession ? session : undefined
      )

    // Running through the pause: the 100 s pause is given back.
    expect(remaining(ago(400), true)).toBe(remaining(ago(400), false) + 100)
    // Started after the pause: nothing changes.
    expect(remaining(ago(100), true)).toBe(remaining(ago(100), false))

    const ranked = (startedAt: Date, clearedAt: Date, withSession: boolean) =>
      scoreEscapeRoomAttempt({
        startedAt,
        penaltySeconds: 0,
        stages: [{ outcome: 'SOLVED', at: clearedAt }],
        session: withSession ? session : undefined,
      }).rankedSeconds
    // Completed before the pause: ranked time is untouched.
    expect(ranked(ago(500), ago(450), true)).toBe(50)
    // Completed after it: the pause does not count.
    expect(ranked(ago(400), ago(150), true)).toBe(150)
    expect(ranked(ago(400), ago(150), false)).toBe(250)

    // An attempt that would be over on the wall clock is still running.
    const nearlyOver = attempt(ago(1000 + ESCAPE_ROOM_GRACE_SECONDS + 50))
    expect(isEscapeRoomExpired(nearlyOver, now)).toBe(true)
    expect(isEscapeRoomExpired(nearlyOver, now, session)).toBe(false)
  })

  it('freezes time and lockout while paused', () => {
    const now = Date.now()
    const pausedAt = new Date(now - 500_000)
    const session = {
      sessionClock: true,
      sessionPhase: DB.EscapeRoomSessionPhase.PAUSED,
      sessionPauses: [],
      sessionPausedAt: pausedAt,
    }
    const startedAt = new Date(pausedAt.getTime() - 100_000)

    expect(
      getEscapeRoomRemainingSeconds({ startedAt, timeLimit: 600 }, now, session)
    ).toBe(500)
    expect(
      getEscapeRoomLockoutRemainingSeconds(
        { lockoutUntil: new Date(pausedAt.getTime() + 20_000) },
        now,
        session
      )
    ).toBe(20)
    expect(
      getEscapeRoomLockoutRemainingSeconds(
        { lockoutUntil: new Date(pausedAt.getTime() + 20_000) },
        now,
        { ...session, sessionPhase: DB.EscapeRoomSessionPhase.RUNNING }
      )
    ).toBe(0)
  })

  it("keeps today's numbers when the clock is off", () => {
    const now = Date.now()
    const config = {
      groupActivityId: 'activity',
      sessionClock: false,
      sessionPhase: DB.EscapeRoomSessionPhase.LOBBY,
      sessionPausedAt: new Date(now - 1000),
      sessionPauses: [
        {
          startedAt: new Date(now - 300_000).toISOString(),
          endedAt: new Date(now - 200_000).toISOString(),
        },
      ],
    }
    const attempt = { startedAt: new Date(now - 400_000), timeLimit: 1000 }

    expect(getGroupEscapeRoomSession(config)).toBeUndefined()
    expect(getEscapeRoomRemainingSeconds(attempt, now, config)).toBe(
      getEscapeRoomRemainingSeconds(attempt, now)
    )
    expect(getEscapeRoomRemainingSeconds(attempt, now)).toBe(600)
    // Other modes have no activity link and so never receive a session.
    expect(
      getGroupEscapeRoomSession({
        ...config,
        groupActivityId: null,
        sessionClock: true,
      })
    ).toBeUndefined()
  })
})

describe('Group Activity session clock - ending', () => {
  it('rejects an answer that races the end and leaves no running attempt', async () => {
    const fixture = await seedSession(Phase.RUNNING)
    const end = () =>
      setEscapeRoomSessionPhase(
        { groupActivityId: fixture.groupActivity.id, phase: Phase.ENDED },
        lecturerCtx
      )

    const [, ended] = await Promise.allSettled([fixture.answer(0), end()])
    if (ended.status === 'rejected') {
      // A serialization conflict between the two writes is retried once.
      await end()
    }

    expect((await fixture.attemptRow()).status).toBe(
      DB.EscapeRoomStatus.EXPIRED
    )
    await expect(fixture.answer(0)).rejects.toMatchObject(NOT_RUNNING)
  })

  it('finalizes a running attempt on read once the activity is no longer published', async () => {
    const fixture = await seedSession(Phase.RUNNING)
    await prisma.groupActivity.update({
      where: { id: fixture.groupActivity.id },
      data: { status: DB.PublicationStatus.ENDED },
    })

    await getGroupActivityDetails(
      {
        activityId: fixture.groupActivity.id,
        groupId: fixture.group.id,
      },
      fixture.memberCtx
    )

    expect((await fixture.attemptRow()).status).toBe(
      DB.EscapeRoomStatus.EXPIRED
    )
  })

  it('finalizes a running attempt on the dashboard once the window has passed', async () => {
    const fixture = await seedSession(Phase.RUNNING)
    await prisma.groupActivity.update({
      where: { id: fixture.groupActivity.id },
      data: { scheduledEndAt: secondsAgo(5) },
    })

    const progress = await getEscapeRoomProgress(
      { groupActivityId: fixture.groupActivity.id },
      lecturerCtx
    )

    expect(
      progress!.attempts.find((entry) => entry.groupId === fixture.group.id)
        ?.status
    ).toBe(DB.EscapeRoomStatus.EXPIRED)
    expect((await fixture.attemptRow()).status).toBe(
      DB.EscapeRoomStatus.EXPIRED
    )
  })

  it('leaves attempts of an activity without a clock running after it closes', async () => {
    const fixture = await seedSession(null)
    await prisma.groupActivity.update({
      where: { id: fixture.groupActivity.id },
      data: { status: DB.PublicationStatus.ENDED },
    })

    await getGroupActivityDetails(
      { activityId: fixture.groupActivity.id, groupId: fixture.group.id },
      fixture.memberCtx
    )

    expect((await fixture.attemptRow()).status).toBe(
      DB.EscapeRoomStatus.IN_PROGRESS
    )
  })

  it('ends the session when the lecturer ends the activity', async () => {
    const fixture = await seedSession(Phase.PAUSED)
    const ctx = createCtx(lecturerCtx.user)
    ctx.pubSub = { publish: vi.fn() } as never

    await endGroupActivity({ id: fixture.groupActivity.id }, ctx as never)

    expect((await fixture.configRow()).sessionPhase).toBe(Phase.ENDED)
    expect((await fixture.attemptRow()).status).toBe(
      DB.EscapeRoomStatus.EXPIRED
    )
  })

  it('ends the session when the activity window expires', async () => {
    const fixture = await seedSession(Phase.RUNNING)
    await prisma.groupActivity.update({
      where: { id: fixture.groupActivity.id },
      data: { scheduledEndAt: secondsAgo(5) },
    })
    const ctx = createCtx(undefined)
    ctx.pubSub = { publish: vi.fn() } as never

    await handleEndExpiredGroupActivity(
      { groupActivityId: fixture.groupActivity.id } as never,
      ctx as never,
      {} as never
    )

    expect((await fixture.configRow()).sessionPhase).toBe(Phase.ENDED)
    expect((await fixture.attemptRow()).status).toBe(
      DB.EscapeRoomStatus.EXPIRED
    )
  })

  it('blocks a reset after the end but not while paused', async () => {
    const paused = await seedSession(Phase.PAUSED)
    await expect(resetEscapeRoomAttempt(paused.ids, lecturerCtx)).resolves.toBe(
      true
    )

    const ended = await seedSession(Phase.ENDED)
    await expect(
      resetEscapeRoomAttempt(ended.ids, lecturerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_SESSION_ENDED' },
    })
    expect(await ended.attemptRow()).not.toBeNull()
    expect(
      await prisma.groupActivityInstance.findUnique({
        where: { id: ended.activityInstance.id },
      })
    ).not.toBeNull()
  })
})

describe('Group Activity session clock - masking', () => {
  async function visibleStageCount(
    fixture: Awaited<ReturnType<typeof seedSession>>
  ) {
    const details = await getGroupActivityDetails(
      { activityId: fixture.groupActivity.id, groupId: fixture.group.id },
      fixture.memberCtx
    )
    return details!.stacks.flatMap((stack) => stack.elements).length
  }

  it('hides every stage in the lobby and while paused, and shows them after the end', async () => {
    const lobby = await seedSession(Phase.LOBBY)
    const paused = await seedSession(Phase.PAUSED)
    const running = await seedSession(Phase.RUNNING)
    const ended = await seedSession(Phase.ENDED)

    expect(await visibleStageCount(lobby)).toBe(0)
    expect(await visibleStageCount(paused)).toBe(0)
    // Only the current stage of the running attempt is visible.
    expect(await visibleStageCount(running)).toBe(1)
    expect(await visibleStageCount(ended)).toBe(2)
  })
})
