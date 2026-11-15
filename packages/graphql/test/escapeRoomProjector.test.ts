import { createHmac } from 'node:crypto'
import { createYoga } from 'graphql-yoga'
import { describe, expect, it, vi } from 'vitest'
import {
  getEscapeRoomGroupProjectorDigest,
  getEscapeRoomProjectorDigest,
} from '../src/services/escapeRoomProgress.js'
import {
  courseId,
  createCtx,
  createUserCtx,
  DB,
  lecturerCtx,
  prisma,
  recomputeDerivedPermissions,
  scElement,
  schema,
  seedEscapeRoomGroupActivity,
  seedEscapeRoomLiveQuiz,
  seedParticipant,
} from './escapeRoomTestHarness.js'

const QUERY = `query ($liveQuizId: String, $elementBlockId: Int, $digest: String) {
  escapeRoomProjector(liveQuizId: $liveQuizId, elementBlockId: $elementBlockId, digest: $digest) {
    phase serverNow closesAt timeLimit totalStages startedCount rankedCount
    rows { rank displayName avatar clearedStages solvedStages revealedStages skippedStages bonusCorrect rankedSeconds status endsAt }
    stages { stageKey title isBonus solved revealed skipped attemptedNotCleared notReached wrongAttempts hintsUsed bonusCorrect bonusWrong debrief }
  }
}`

function withRedis<T extends { redisExec: any }>(ctx: T): T {
  const pipeline = {
    smembers: vi.fn().mockReturnThis(),
    exec: vi.fn(async () => pipeline.smembers.mock.calls.map(() => [null, []])),
  }
  return { ...ctx, redisExec: { ...ctx.redisExec, pipeline: () => pipeline } }
}

const PROGRESS_QUERY = `query ($liveQuizId: String, $elementBlockId: Int) {
  escapeRoomProgress(liveQuizId: $liveQuizId, elementBlockId: $elementBlockId) {
    attempts { participantId rank }
  }
}`

async function run(
  ctx: any,
  variables: {
    liveQuizId?: string
    elementBlockId?: number
    groupActivityId?: string
    digest?: string
  },
  query = QUERY
) {
  const yoga = createYoga({ schema, context: () => withRedis(ctx) })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  return (await response.json()) as {
    data?: Record<string, any> | null
    errors?: { message: string }[]
  }
}

async function seedBlock() {
  const { liveQuiz, block } = await seedEscapeRoomLiveQuiz()
  await recomputeDerivedPermissions(
    { liveQuizId: liveQuiz.id, userId: lecturerCtx.user.sub },
    prisma
  )
  const instanceId = block.elements[0]!.id
  return { liveQuiz, block, instanceId }
}

async function seedAttempt(
  blockId: number,
  stageKey: string,
  label: string,
  profilePublic = true
) {
  const participant = await seedParticipant(label)
  await prisma.participant.update({
    where: { id: participant.id },
    data: { isProfilePublic: profilePublic },
  })
  const attempt = await prisma.escapeRoomAttempt.create({
    data: {
      participantId: participant.id,
      elementBlockId: blockId,
      status: DB.EscapeRoomStatus.IN_PROGRESS,
      timeLimit: 300,
      startedAt: new Date(),
      stageOutcomes: [
        {
          stageKey,
          wrongAttempts: 0,
          outcome: 'SOLVED',
          at: new Date().toISOString(),
        },
      ] as any,
    },
  })
  return { participant, attempt }
}

// The projector digests are HMACs over APP_SECRET; CI does not set it.
process.env.APP_SECRET = process.env.APP_SECRET ?? 'test-app-secret'

describe('Live Quiz escape-room projector', () => {
  it('rejects wrong digests and the results-page digest', async () => {
    const { liveQuiz, block } = await seedBlock()
    const other = await seedBlock()
    const anonymous = createCtx()
    const variables = { liveQuizId: liveQuiz.id, elementBlockId: block.id }

    const resultsDigest = createHmac('sha256', process.env.APP_SECRET as string)
      .update(liveQuiz.namespace + liveQuiz.id)
      .digest('hex')
    for (const digest of [
      undefined,
      'wrong',
      '',
      getEscapeRoomProjectorDigest(other.liveQuiz.id, other.block.id),
      getEscapeRoomProjectorDigest(liveQuiz.id, other.block.id),
      resultsDigest,
    ]) {
      const result = await run(anonymous, { ...variables, digest })
      expect(result.data).toBeNull()
      expect(result.errors).toHaveLength(1)
    }
  })

  it('rejects a lecturer without access and serves one with access', async () => {
    const { liveQuiz, block } = await seedBlock()
    const variables = { liveQuizId: liveQuiz.id, elementBlockId: block.id }

    const stranger = createUserCtx(crypto.randomUUID())
    expect((await run(stranger, variables)).errors).toHaveLength(1)

    const result = await run(lecturerCtx, variables)
    expect(result.errors).toBeUndefined()
    expect(result.data?.escapeRoomProjector).toMatchObject({
      phase: 'RUNNING',
      totalStages: 1,
    })
  })

  it('serves an anonymous caller with the valid digest', async () => {
    const { liveQuiz, block } = await seedBlock()
    const result = await run(createCtx(), {
      liveQuizId: liveQuiz.id,
      elementBlockId: block.id,
      digest: getEscapeRoomProjectorDigest(liveQuiz.id, block.id),
    })
    expect(result.errors).toBeUndefined()
    expect(result.data?.escapeRoomProjector).toMatchObject({ phase: 'RUNNING' })
  })

  it('lists everyone in a non-gamified course and only opted-in participants in a gamified one', async () => {
    const { liveQuiz, block, instanceId } = await seedBlock()
    const stageKey = String(instanceId)
    const optedIn = await seedAttempt(block.id, stageKey, 'proj-in')
    const optedOut = await seedAttempt(block.id, stageKey, 'proj-out', false)
    await prisma.participation.updateMany({
      where: { participantId: optedOut.participant.id },
      data: { isActive: false },
    })
    const variables = {
      liveQuizId: liveQuiz.id,
      elementBlockId: block.id,
      digest: getEscapeRoomProjectorDigest(liveQuiz.id, block.id),
    }

    await prisma.course.update({
      where: { id: courseId },
      data: { isGamificationEnabled: false },
    })
    const plain = await run(createCtx(), variables)
    const plainData = plain.data?.escapeRoomProjector as any
    expect(plainData.rows).toHaveLength(2)
    const names = plainData.rows.map((row: any) => row.displayName)
    expect(names).toContain(optedIn.participant.username)
    expect(names).toContain('Anonymous')

    await prisma.course.update({
      where: { id: courseId },
      data: { isGamificationEnabled: true },
    })
    try {
      const gamified = await run(createCtx(), variables)
      const data = gamified.data?.escapeRoomProjector as any
      expect(data.rows).toHaveLength(1)
      expect(data.rows[0]).toMatchObject({
        displayName: optedIn.participant.username,
        rank: 1,
      })
      expect(data.startedCount).toBe(2)
      expect(data.rankedCount).toBe(1)
      expect(data.stages[0]).toMatchObject({ solved: 2 })

      // the lecturer dashboard keeps both rows but ranks only the opted-in one
      const progress = await run(
        lecturerCtx,
        { liveQuizId: liveQuiz.id, elementBlockId: block.id },
        PROGRESS_QUERY
      )
      const ranks = new Map(
        (progress.data?.escapeRoomProgress as any).attempts.map(
          (attempt: any) => [attempt.participantId, attempt.rank]
        )
      )
      expect(ranks.get(optedIn.participant.id)).toBe(1)
      expect(ranks.has(optedOut.participant.id)).toBe(true)
      expect(ranks.get(optedOut.participant.id)).toBeNull()
    } finally {
      await prisma.course.update({
        where: { id: courseId },
        data: { isGamificationEnabled: true },
      })
    }
  })

  it('exposes no attempt, participant or group ids', async () => {
    const { liveQuiz, block } = await seedBlock()
    const result = await run(lecturerCtx, {
      liveQuizId: liveQuiz.id,
      elementBlockId: block.id,
    })
    expect(result.errors).toBeUndefined()

    const projectorType = schema.getQueryType()!.getFields()
      .escapeRoomProjector!
    const typeNames = new Set<string>()
    const collect = (type: any) => {
      let named = type
      while (named.ofType) named = named.ofType
      if (!named.getFields || typeNames.has(named.name)) return
      typeNames.add(named.name)
      for (const field of Object.values<any>(named.getFields())) {
        collect(field.type)
      }
    }
    collect(projectorType.type)
    const fields = [...typeNames].flatMap((name) =>
      Object.keys((schema.getType(name) as any).getFields())
    )
    expect(typeNames).toContain('EscapeRoomProjectorRow')
    expect(fields.filter((field) => /(^id$|Id$)/.test(field))).toEqual([])
  })

  it('withholds the debrief until the block is closed', async () => {
    const { liveQuiz, block, instanceId } = await seedBlock()
    await prisma.elementInstance.update({
      where: { id: instanceId },
      data: { options: { escapeRoomDebrief: 'Debrief text' } as any },
    })
    const variables = { liveQuizId: liveQuiz.id, elementBlockId: block.id }

    const running = await run(lecturerCtx, variables)
    expect(
      (running.data?.escapeRoomProjector as any).stages[0].debrief
    ).toBeNull()

    await prisma.elementBlock.update({
      where: { id: block.id },
      data: { status: DB.ElementBlockStatus.EXECUTED },
    })
    const closed = await run(lecturerCtx, variables)
    const data = closed.data?.escapeRoomProjector as any
    expect(data.phase).toBe('CLOSED')
    expect(data.stages[0].debrief).toEqual(expect.any(String))
  })
})

const GROUP_QUERY = `query ($groupActivityId: String, $liveQuizId: String, $elementBlockId: Int, $digest: String) {
  escapeRoomProjector(groupActivityId: $groupActivityId, liveQuizId: $liveQuizId, elementBlockId: $elementBlockId, digest: $digest) {
    phase paused serverNow closesAt timeLimit totalStages startedCount rankedCount
    rows { rank displayName avatar clearedStages status endsAt }
    stages { stageKey debrief }
  }
}`

async function seedGroup(session?: { phase: DB.EscapeRoomSessionPhase }) {
  const participant = await seedParticipant(`proj-group-${crypto.randomUUID()}`)
  const fixture = await seedEscapeRoomGroupActivity(
    {
      elements: [scElement],
      courseId,
      participantIds: [participant.id],
      session,
    },
    lecturerCtx
  )
  await recomputeDerivedPermissions(
    { groupActivityId: fixture.groupActivity.id, userId: lecturerCtx.user.sub },
    prisma
  )
  return fixture
}

describe('Group Activity escape-room projector', () => {
  it('rejects wrong digests, Live Quiz digests and a lecturer without access', async () => {
    const fixture = await seedGroup()
    const other = await seedGroup()
    const live = await seedBlock()
    const variables = { groupActivityId: fixture.groupActivity.id }

    for (const digest of [
      undefined,
      'wrong',
      '',
      getEscapeRoomGroupProjectorDigest(other.groupActivity.id),
      getEscapeRoomProjectorDigest(live.liveQuiz.id, live.block.id),
    ]) {
      const result = await run(
        createCtx(),
        { ...variables, digest },
        GROUP_QUERY
      )
      expect(result.data).toBeNull()
      expect(result.errors).toHaveLength(1)
    }

    const stranger = createUserCtx(crypto.randomUUID())
    expect((await run(stranger, variables, GROUP_QUERY)).errors).toHaveLength(1)
    const lecturer = await run(lecturerCtx, variables, GROUP_QUERY)
    expect(lecturer.errors).toBeUndefined()
  })

  it('does not open a Live Quiz block with a Group Activity digest', async () => {
    const fixture = await seedGroup()
    const live = await seedBlock()
    const result = await run(
      createCtx(),
      {
        liveQuizId: live.liveQuiz.id,
        elementBlockId: live.block.id,
        digest: getEscapeRoomGroupProjectorDigest(fixture.groupActivity.id),
      },
      GROUP_QUERY
    )
    expect(result.data).toBeNull()
    expect(result.errors).toHaveLength(1)
  })

  it('serves the digest, lists groups by name and exposes no ids', async () => {
    const fixture = await seedGroup()
    const result = await run(
      createCtx(),
      {
        groupActivityId: fixture.groupActivity.id,
        digest: getEscapeRoomGroupProjectorDigest(fixture.groupActivity.id),
      },
      GROUP_QUERY
    )
    expect(result.errors).toBeUndefined()
    const data = result.data?.escapeRoomProjector as any
    expect(data).toMatchObject({ phase: 'RUNNING', paused: false })
    expect(data.rows).toHaveLength(1)
    expect(data.rows[0].displayName).toBe(fixture.group.name)
    // the headline countdown follows the group deadline, not the window end
    expect(data.closesAt).not.toBeNull()
    expect(data.closesAt).toBe(data.rows[0].endsAt)
    expect(JSON.stringify(data)).not.toContain(fixture.group.id)
    expect(JSON.stringify(data)).not.toContain(fixture.attempt.id)
  })

  it('maps the publication status to the phase when the clock is off', async () => {
    const fixture = await seedGroup()
    const variables = { groupActivityId: fixture.groupActivity.id }
    const phases: Array<[DB.PublicationStatus, string]> = [
      [DB.PublicationStatus.SCHEDULED, 'LOBBY'],
      [DB.PublicationStatus.PUBLISHED, 'RUNNING'],
      [DB.PublicationStatus.ENDED, 'CLOSED'],
      [DB.PublicationStatus.GRADED, 'CLOSED'],
    ]
    for (const [status, phase] of phases) {
      await prisma.groupActivity.update({
        where: { id: fixture.groupActivity.id },
        data: { status },
      })
      const result = await run(lecturerCtx, variables, GROUP_QUERY)
      expect((result.data?.escapeRoomProjector as any).phase).toBe(phase)
    }
  })

  it('shows the lobby without debriefs before a session-clock activity is published', async () => {
    const fixture = await seedGroup({ phase: DB.EscapeRoomSessionPhase.LOBBY })
    await prisma.elementInstance.update({
      where: { id: fixture.groupActivity.stacks[0]!.elements[0]!.id },
      data: { options: { escapeRoomDebrief: 'Debrief text' } as any },
    })
    await prisma.groupActivity.update({
      where: { id: fixture.groupActivity.id },
      data: { status: DB.PublicationStatus.SCHEDULED },
    })
    const result = await run(
      lecturerCtx,
      { groupActivityId: fixture.groupActivity.id },
      GROUP_QUERY
    )
    const data = result.data?.escapeRoomProjector as any
    expect(data.phase).toBe('LOBBY')
    expect(data.stages[0].debrief).toBeNull()
  })

  it('shows a paused session as running with the paused flag, and withholds the debrief until it is closed', async () => {
    const fixture = await seedGroup({ phase: DB.EscapeRoomSessionPhase.PAUSED })
    await prisma.escapeRoomConfig.update({
      where: { groupActivityId: fixture.groupActivity.id },
      data: { sessionPausedAt: new Date(Date.now() - 30_000) },
    })
    await prisma.elementInstance.update({
      where: { id: fixture.groupActivity.stacks[0]!.elements[0]!.id },
      data: { options: { escapeRoomDebrief: 'Debrief text' } as any },
    })
    const variables = { groupActivityId: fixture.groupActivity.id }

    const paused = (await run(lecturerCtx, variables, GROUP_QUERY)).data
      ?.escapeRoomProjector as any
    expect(paused).toMatchObject({ phase: 'RUNNING', paused: true })
    expect(paused.stages[0].debrief).toBeNull()
    expect(paused.rows[0].endsAt).not.toBeNull()
    expect(paused.closesAt).toBeNull()

    await prisma.escapeRoomConfig.update({
      where: { groupActivityId: fixture.groupActivity.id },
      data: { sessionPhase: DB.EscapeRoomSessionPhase.ENDED },
    })
    const closed = (await run(lecturerCtx, variables, GROUP_QUERY)).data
      ?.escapeRoomProjector as any
    expect(closed).toMatchObject({ phase: 'CLOSED', paused: false })
    expect(closed.stages[0].debrief).toEqual(expect.any(String))
  })

  it('reports the lobby phase and exposes the digest to lecturers on the progress payload', async () => {
    const fixture = await seedGroup({ phase: DB.EscapeRoomSessionPhase.LOBBY })
    const lobby = await run(
      lecturerCtx,
      { groupActivityId: fixture.groupActivity.id },
      GROUP_QUERY
    )
    expect((lobby.data?.escapeRoomProjector as any).phase).toBe('LOBBY')

    const progress = await run(
      lecturerCtx,
      { groupActivityId: fixture.groupActivity.id },
      `query ($groupActivityId: String) { escapeRoomProgress(groupActivityId: $groupActivityId) { projectorDigest } }`
    )
    expect((progress.data?.escapeRoomProgress as any).projectorDigest).toBe(
      getEscapeRoomGroupProjectorDigest(fixture.groupActivity.id)
    )
  })
})
