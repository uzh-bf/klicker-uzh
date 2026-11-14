import { createHmac } from 'node:crypto'
import { createYoga } from 'graphql-yoga'
import { describe, expect, it, vi } from 'vitest'
import { getEscapeRoomProjectorDigest } from '../src/services/escapeRoomProgress.js'
import {
  courseId,
  createCtx,
  createUserCtx,
  DB,
  lecturerCtx,
  prisma,
  recomputeDerivedPermissions,
  schema,
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

async function run(
  ctx: any,
  variables: { liveQuizId: string; elementBlockId: number; digest?: string }
) {
  const yoga = createYoga({ schema, context: () => withRedis(ctx) })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables }),
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
