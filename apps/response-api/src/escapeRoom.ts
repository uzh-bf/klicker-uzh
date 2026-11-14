import {
  applyEscapeRoomWrongAnswer,
  areEscapeRoomRegularStagesCleared,
  getEscapeRoomBonusCredit,
  getEscapeRoomRulesFromConfig,
  getEscapeRoomStageOutcomeRecord,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
  parseEscapeRoomStageOutcomeRecords,
  resolveEscapeRoomAnswerableStage,
  setEscapeRoomStageOutcomeRecord,
  type EscapeRoomAnswerableStageDecision,
  type EscapeRoomStageOutcomeRecord,
} from '@klicker-uzh/grading'
import { hatchetClient } from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import {
  ESCAPE_ROOM_SUPPORTED_ELEMENT_TYPES,
  getEscapeRoomLifecycleClaimKey,
  gradeQrScanResponse,
  isEscapeRoomExpired,
  isValidQrScanCode,
  normalizeQrScanCode,
} from '@klicker-uzh/types'
import {
  acquireEscapeRoomResponseSlot,
  completeEscapeRoomResponseEvent,
  releaseEscapeRoomResponseSlot,
  trackEscapeRoomResponseEvent,
  verifyJWT,
  type JWTPayload,
} from '@klicker-uzh/util'
import type { Prisma } from '@klicker-uzh/prisma/client'
import type { ServerResponse } from 'http'
import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'

const RELEASE_ESCAPE_ROOM_CLAIM = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0
`

async function getParticipantData(
  cookieHeader?: string
): Promise<JWTPayload | null> {
  if (!cookieHeader) return null
  const parsedCookies = cookieHeader
    .split(';')
    .map((v) => v.split('='))
    .reduce<Record<string, string>>((acc, v) => {
      if (v.length >= 2) {
        acc[decodeURIComponent(v[0]!.trim())] = decodeURIComponent(v[1]!.trim())
      }
      return acc
    }, {})

  try {
    if (parsedCookies['participant_token'] !== undefined) {
      const payload = await verifyJWT(
        parsedCookies['participant_token'],
        process.env.APP_SECRET as string
      )
      if (payload.role === 'PARTICIPANT') return payload
    }
  } catch (e) {
    console.error('JWT verification failed in response-api:', e)
  }
  return null
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(json))
  res.end(json)
}

type EscapeRoomInstanceState = Awaited<
  ReturnType<typeof loadEscapeRoomInstanceState>
>

interface EscapeRoomChoice {
  ix: number
  selected: boolean
}

interface EscapeRoomResponse {
  choices?: EscapeRoomChoice[]
  value?: string
}

function isEscapeRoomChoice(value: unknown): value is EscapeRoomChoice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const choice = value as Record<string, unknown>
  return (
    Number.isInteger(choice.ix) &&
    Number(choice.ix) >= 0 &&
    typeof choice.selected === 'boolean'
  )
}

function validateEscapeRoomResponse(
  type: string | undefined,
  response: unknown
): EscapeRoomResponse | null {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return null
  }

  const value = response as Record<string, unknown>
  if (type === 'SC' || type === 'MC' || type === 'KPRIM') {
    if (
      !Array.isArray(value.choices) ||
      !value.choices.every(isEscapeRoomChoice)
    ) {
      return null
    }
    return { choices: value.choices }
  }

  if (type === 'NUMERICAL' || type === 'FREE_TEXT' || type === 'QR_SCAN') {
    return typeof value.value === 'string' ? { value: value.value } : null
  }

  return null
}

function loadEscapeRoomInstanceState(instanceId: number) {
  return prisma.elementInstance.findUnique({
    where: { id: instanceId },
    select: {
      elementBlockId: true,
      elementBlock: {
        select: {
          liveQuizId: true,
          status: true,
          liveQuiz: { select: { activeBlockId: true } },
          escapeRoomConfig: {
            select: {
              hintPenalty: true,
              hintPenalties: true,
              wrongAnswerPenalty: true,
              maxWrongAttempts: true,
              revealPenalty: true,
              skipPenalty: true,
              bonusSeconds: true,
              lockoutSeconds: true,
            },
          },
        },
      },
      element: { select: { qrScanCode: true } },
    },
  })
}

function isActiveEscapeRoomInstance(
  instance: EscapeRoomInstanceState,
  blockId: number,
  liveQuizId: string
) {
  return !!(
    instance &&
    instance.elementBlockId === blockId &&
    instance.elementBlock?.liveQuizId === liveQuizId &&
    instance.elementBlock.status === 'ACTIVE' &&
    instance.elementBlock.liveQuiz.activeBlockId === blockId
  )
}

// Maps a failed stage decision to its error response. An expired attempt that
// is still running is marked EXPIRED; a completed attempt never changes.
async function rejectStage(
  res: ServerResponse,
  decision: Extract<EscapeRoomAnswerableStageDecision, { ok: false }>,
  attempt: { id: string; status: string }
) {
  if (decision.reason === 'expired') {
    if (attempt.status === 'IN_PROGRESS') {
      await prisma.escapeRoomAttempt.updateMany({
        where: { id: attempt.id, status: 'IN_PROGRESS' },
        data: { status: 'EXPIRED' },
      })
    }
    sendJson(res, 400, { error: 'escape_room_expired' })
  } else if (decision.reason === 'not_in_progress') {
    sendJson(res, 400, { error: 'escape_room_not_in_progress' })
  } else if (decision.reason === 'bonus_answered') {
    sendJson(res, 400, { error: 'escape_room_bonus_answered' })
  } else if (decision.reason === 'cleared') {
    sendJson(res, 409, { error: 'escape_room_stage_cleared' })
  } else {
    sendJson(res, 409, { error: 'escape_room_stage_locked' })
  }
}

function getInstanceRules(instance: EscapeRoomInstanceState) {
  const config = instance?.elementBlock?.escapeRoomConfig
  return {
    rules: getEscapeRoomRulesFromConfig(config),
    lockoutSeconds: config?.lockoutSeconds,
  }
}

// The solution shown with a reveal; QR scan stages have none to show.
function getRevealedSolution(type: string | undefined, solutions: unknown) {
  if (type === 'QR_SCAN' || solutions === undefined) return null
  return solutions
}

function parseSolutions(raw: string | undefined) {
  if (!raw) return { ok: true as const, value: undefined }
  try {
    return { ok: true as const, value: JSON.parse(raw) }
  } catch {
    return { ok: false as const, value: undefined }
  }
}

async function completeAttempt(attemptId: string) {
  await prisma.escapeRoomAttempt.updateMany({
    where: { id: attemptId, status: 'IN_PROGRESS' },
    data: { status: 'COMPLETED', completedAt: new Date(), lockoutUntil: null },
  })
}

export async function handleEscapeRoomValidation(
  res: ServerResponse,
  payload: { response: unknown; liveQuizId: string; instanceId: number },
  cookie: string | undefined,
  instanceInfo: Record<string, string>,
  redis: Redis
): Promise<boolean> {
  if (instanceInfo.isEscapeRoom !== 'true') {
    return false
  }

  const { response: submittedResponse, liveQuizId, instanceId } = payload

  const participantData = await getParticipantData(cookie)
  if (!participantData) {
    sendJson(res, 401, { error: 'unauthorized_participant' })
    return true
  }

  const blockId = Number(instanceInfo.sessionBlockId)
  if (!Number.isInteger(blockId) || blockId <= 0) {
    sendJson(res, 400, { error: 'escape_room_invalid_block' })
    return true
  }
  if (instanceInfo.blockClosedAt) {
    sendJson(res, 409, { error: 'escape_room_block_closed' })
    return true
  }

  const instance = await loadEscapeRoomInstanceState(instanceId)
  if (!isActiveEscapeRoomInstance(instance, blockId, liveQuizId)) {
    sendJson(res, 400, { error: 'escape_room_instance_block_mismatch' })
    return true
  }

  const attempt = await prisma.escapeRoomAttempt.findUnique({
    where: {
      participantId_elementBlockId: {
        participantId: participantData.sub,
        elementBlockId: blockId,
      },
    },
  })

  if (!attempt) {
    sendJson(res, 400, { error: 'escape_room_attempt_not_started' })
    return true
  }

  if (
    attempt.status === 'IN_PROGRESS' &&
    attempt.lockoutUntil &&
    Date.now() < new Date(attempt.lockoutUntil).getTime()
  ) {
    sendJson(res, 429, {
      status: 'lockout',
      lockoutUntil: attempt.lockoutUntil,
    })
    return true
  }

  const requiredInstances = await prisma.elementInstance.findMany({
    where: {
      elementBlockId: blockId,
      elementType: { in: [...ESCAPE_ROOM_SUPPORTED_ELEMENT_TYPES] },
    },
    select: { id: true },
    orderBy: { order: 'asc' },
  })
  const stages = requiredInstances.map((entry) => String(entry.id))
  const stageKey = String(instanceId)
  const clearedKey = `escape-attempt:${attempt.id}:cleared`
  let clearedInstances = new Set(await redis.smembers(clearedKey))
  // Cheap early rejection; every outcome is decided again under the claim.
  const earlyDecision = resolveEscapeRoomAnswerableStage({
    stages,
    stageKey,
    rules: getInstanceRules(instance).rules,
    status: attempt.status,
    expired: isEscapeRoomExpired(attempt),
    outcomes: parseEscapeRoomStageOutcomeRecords(attempt.stageOutcomes),
    clearedKeys: clearedInstances,
  })
  if (!earlyDecision.ok && earlyDecision.reason !== 'cleared') {
    await rejectStage(res, earlyDecision, attempt)
    return true
  }

  const type = instanceInfo.type
  const response = validateEscapeRoomResponse(type, submittedResponse)
  if (!response) {
    sendJson(res, 400, { error: 'invalid_escape_room_response' })
    return true
  }

  const claimKey = getEscapeRoomLifecycleClaimKey(
    'liveQuizBlock',
    blockId,
    participantData.sub
  )
  const claimToken = randomUUID()
  const claimed = await redis.set(claimKey, claimToken, 'EX', 300, 'NX')
  if (claimed !== 'OK') {
    sendJson(res, 409, { error: 'escape_room_response_processing' })
    return true
  }

  const responseSlotToken = randomUUID()
  let responseSlotAcquired = false
  try {
    responseSlotAcquired = await acquireEscapeRoomResponseSlot({
      redis,
      blockId,
      token: responseSlotToken,
    })
    if (!responseSlotAcquired) {
      sendJson(res, 409, { error: 'escape_room_block_closed' })
      return true
    }

    const [currentInstanceState, currentInstanceInfo] = await Promise.all([
      loadEscapeRoomInstanceState(instanceId),
      redis.hgetall(`lq:${liveQuizId}:i:${instanceId}:info`),
    ])
    if (
      currentInstanceInfo.blockClosedAt ||
      !isActiveEscapeRoomInstance(currentInstanceState, blockId, liveQuizId)
    ) {
      sendJson(res, 409, { error: 'escape_room_block_closed' })
      return true
    }
    const { rules, lockoutSeconds: configLockoutSeconds } =
      getInstanceRules(currentInstanceState)

    const currentAttempt = await prisma.escapeRoomAttempt.findUnique({
      where: { id: attempt.id },
    })
    if (!currentAttempt) {
      sendJson(res, 400, { error: 'escape_room_not_in_progress' })
      return true
    }
    if (
      currentAttempt.status === 'IN_PROGRESS' &&
      currentAttempt.lockoutUntil &&
      Date.now() < new Date(currentAttempt.lockoutUntil).getTime()
    ) {
      sendJson(res, 429, {
        status: 'lockout',
        lockoutUntil: currentAttempt.lockoutUntil,
      })
      return true
    }
    const outcomes = parseEscapeRoomStageOutcomeRecords(
      currentAttempt.stageOutcomes
    )
    clearedInstances = new Set(await redis.smembers(clearedKey))
    const decision = resolveEscapeRoomAnswerableStage({
      stages,
      stageKey,
      rules,
      status: currentAttempt.status,
      expired: isEscapeRoomExpired(currentAttempt),
      outcomes,
      clearedKeys: clearedInstances,
    })

    const hasBonus = rules.bonusSeconds !== null && stages.length > 1
    const priorPenaltySeconds = currentAttempt.penaltySeconds ?? 0
    const markCleared = async () => {
      await redis.sadd(clearedKey, stageKey)
      clearedInstances.add(stageKey)
      await redis.expire(clearedKey, 60 * 60 * 24 * 30)
    }
    const writeOutcome = (
      record: EscapeRoomStageOutcomeRecord,
      extra: { penaltySeconds?: number; lockoutUntil?: Date | null } = {}
    ) =>
      prisma.escapeRoomAttempt.update({
        where: { id: attempt.id },
        data: {
          stageOutcomes: setEscapeRoomStageOutcomeRecord(
            outcomes,
            record
          ) as unknown as Prisma.InputJsonValue,
          ...(extra.penaltySeconds
            ? { penaltySeconds: { increment: extra.penaltySeconds } }
            : {}),
          ...(extra.lockoutUntil !== undefined
            ? { lockoutUntil: extra.lockoutUntil }
            : {}),
        },
      })
    const regularStagesCleared = () =>
      areEscapeRoomRegularStagesCleared({
        stages,
        rules,
        outcomes,
        // The stage answered in this request is added to the set before the
        // check, so the stored outcomes need not be re-read.
        clearedKeys: clearedInstances,
      })

    if (!decision.ok && decision.reason !== 'cleared') {
      await rejectStage(res, decision, currentAttempt)
      return true
    }
    if (!decision.ok) {
      // Cleared earlier. A retry repairs a Redis write that failed after the
      // outcome was stored, then finishes a completion that did not persist.
      const record = getEscapeRoomStageOutcomeRecord(outcomes, stageKey)
      if (!clearedInstances.has(stageKey) && record.outcome !== null) {
        await markCleared()
      }
      const blockCompleted = regularStagesCleared()
      if (blockCompleted) await completeAttempt(currentAttempt.id)
      if (record.outcome === 'REVEALED' || record.outcome === 'SKIPPED') {
        sendJson(res, 409, { error: 'escape_room_stage_cleared' })
        return true
      }
      sendJson(res, 200, {
        status: 'correct',
        completed: blockCompleted,
        lockoutUntil: null,
        responseTimestamp: Date.now(),
        attemptsLeft: null,
        revealed: false,
        revealedSolution: null,
        penaltySeconds: priorPenaltySeconds,
        bonusPending: blockCompleted && hasBonus,
        bonus: null,
      })
      return true
    }

    // Grade response
    let pointsPercentage = 0
    const parsed = parseSolutions(instanceInfo.solutions)
    if (!parsed.ok) {
      sendJson(res, 400, { error: 'invalid_solutions_json' })
      return true
    }
    const parsedSolutions: any = parsed.value

    if (type === 'SC') {
      pointsPercentage =
        gradeQuestionSC({
          responseCount: Number(instanceInfo.choiceCount),
          response: response.choices || [],
          solution: parsedSolutions || [],
        }) || 0
    } else if (type === 'MC') {
      pointsPercentage =
        gradeQuestionMC({
          responseCount: Number(instanceInfo.choiceCount),
          response: response.choices || [],
          solution: parsedSolutions || [],
        }) || 0
    } else if (type === 'KPRIM') {
      pointsPercentage =
        gradeQuestionKPRIM({
          responseCount: Number(instanceInfo.choiceCount),
          response: response.choices || [],
          solution: parsedSolutions || [],
        }) || 0
    } else if (type === 'NUMERICAL') {
      const numValue = Number(response.value)
      if (isNaN(numValue)) {
        pointsPercentage = 0
      } else {
        const exactSolutionsDefined =
          typeof parsedSolutions !== 'undefined' &&
          parsedSolutions.length > 0 &&
          (typeof parsedSolutions[0] === 'number' ||
            typeof parsedSolutions[0] === 'string')
        pointsPercentage =
          gradeQuestionNumerical({
            response: numValue,
            solutionRanges: exactSolutionsDefined ? undefined : parsedSolutions,
            exactSolutions: exactSolutionsDefined ? parsedSolutions : undefined,
          }) || 0
      }
    } else if (type === 'FREE_TEXT') {
      pointsPercentage =
        gradeQuestionFreeText({
          response: (response.value || '').trim(),
          solutions: parsedSolutions || [],
        }) || 0
    } else if (type === 'QR_SCAN') {
      const code = normalizeQrScanCode(response.value)
      if (!isValidQrScanCode(code)) {
        sendJson(res, 400, { error: 'invalid_qr_code' })
        return true
      }
      pointsPercentage = gradeQrScanResponse(
        currentInstanceState!.element.qrScanCode,
        code
      )
        ? 1
        : 0
    }

    const isCorrect = pointsPercentage === 1
    const triesKey = `lq:${liveQuizId}:i:${instanceId}:tries:${participantData.sub}`
    const previous = getEscapeRoomStageOutcomeRecord(outcomes, stageKey)
    const answeredAt = new Date().toISOString()

    if (isCorrect) {
      // Correct! Fetch tries and send event to Hatchet to save
      const triesRaw = await redis.get(triesKey)
      const tries = triesRaw ? Number(triesRaw) + 1 : 1

      const responseTimestamp = Date.now()

      const message = {
        messageId: `escape:${attempt.id}:${instanceId}`,
        sessionId: String(liveQuizId),
        blockId,
        instanceId: String(instanceId),
        response,
        cookie,
        responseTimestamp,
        tries,
      }

      await trackEscapeRoomResponseEvent({
        redis,
        blockId,
        messageId: message.messageId,
      })
      try {
        await hatchetClient.events.push(
          'response-received:authenticated',
          message
        )
      } catch (error) {
        await completeEscapeRoomResponseEvent({
          redis,
          blockId,
          messageId: message.messageId,
        })
        throw error
      }
      // The outcome is stored before the cleared set so that a failed Redis
      // write is repaired by the next submission.
      await writeOutcome(
        decision.isBonus
          ? {
              stageKey,
              wrongAttempts: previous.wrongAttempts,
              outcome: 'BONUS_CORRECT',
              at: answeredAt,
              creditSeconds: getEscapeRoomBonusCredit(rules, true),
            }
          : {
              stageKey,
              wrongAttempts: previous.wrongAttempts,
              outcome: 'SOLVED',
              at: answeredAt,
            }
      )
      await markCleared()
      await redis.del(triesKey)

      const blockCompleted = decision.isBonus || regularStagesCleared()
      if (blockCompleted && !decision.isBonus) {
        await completeAttempt(attempt.id)
      }
      sendJson(res, 200, {
        status: 'correct',
        completed: blockCompleted,
        lockoutUntil: null,
        responseTimestamp,
        attemptsLeft: null,
        revealed: false,
        revealedSolution: null,
        penaltySeconds: priorPenaltySeconds,
        bonusPending: !decision.isBonus && blockCompleted && hasBonus,
        bonus: decision.isBonus ? 'correct' : null,
      })
      return true
    }

    if (decision.isBonus) {
      // One answer only: a wrong bonus answer costs nothing and locks nothing.
      await writeOutcome({
        stageKey,
        wrongAttempts: previous.wrongAttempts,
        outcome: 'BONUS_WRONG',
        at: answeredAt,
        creditSeconds: 0,
      })
      await markCleared()
      await redis.del(triesKey)
      sendJson(res, 200, {
        status: 'incorrect',
        completed: true,
        lockoutUntil: null,
        responseTimestamp: Date.now(),
        attemptsLeft: null,
        revealed: false,
        revealedSolution: null,
        penaltySeconds: priorPenaltySeconds,
        bonusPending: false,
        bonus: 'wrong',
      })
      return true
    }

    const wrong = applyEscapeRoomWrongAnswer(rules, previous.wrongAttempts)
    const penaltySeconds = priorPenaltySeconds + wrong.penaltySeconds

    if (wrong.revealed) {
      // Reveal clears the stage without a solved response: Prisma first, then
      // the cleared set, and neither an event nor a lockout.
      await writeOutcome(
        {
          stageKey,
          wrongAttempts: wrong.wrongAttempts,
          outcome: 'REVEALED',
          at: answeredAt,
        },
        { penaltySeconds: wrong.penaltySeconds }
      )
      await markCleared()
      await redis.del(triesKey)

      const blockCompleted = regularStagesCleared()
      if (blockCompleted) await completeAttempt(attempt.id)
      sendJson(res, 200, {
        status: 'incorrect',
        completed: blockCompleted,
        lockoutUntil: null,
        responseTimestamp: Date.now(),
        attemptsLeft: 0,
        revealed: true,
        revealedSolution: getRevealedSolution(type, parsedSolutions),
        penaltySeconds,
        bonusPending: blockCompleted && hasBonus,
        bonus: null,
      })
      return true
    }

    // Incorrect! Apply lockout and increment tries
    await redis
      .multi()
      .incr(triesKey)
      .expire(triesKey, 60 * 60 * 24 * 30)
      .exec()
    const lockoutSeconds =
      configLockoutSeconds ?? Number(instanceInfo.escapeRoomLockoutSeconds || 0)
    const lockoutUntil =
      lockoutSeconds > 0 ? new Date(Date.now() + lockoutSeconds * 1000) : null

    await writeOutcome(
      {
        stageKey,
        wrongAttempts: wrong.wrongAttempts,
        outcome: null,
        at: null,
      },
      {
        penaltySeconds: wrong.penaltySeconds,
        ...(lockoutUntil ? { lockoutUntil } : {}),
      }
    )

    sendJson(res, 200, {
      status: 'incorrect',
      completed: false,
      lockoutUntil,
      responseTimestamp: Date.now(),
      attemptsLeft: wrong.attemptsLeft,
      revealed: false,
      revealedSolution: null,
      penaltySeconds,
      bonusPending: false,
      bonus: null,
    })
    return true
  } finally {
    if (responseSlotAcquired) {
      await releaseEscapeRoomResponseSlot({
        redis,
        blockId,
        token: responseSlotToken,
      })
    }
    await redis.eval(RELEASE_ESCAPE_ROOM_CLAIM, 1, claimKey, claimToken)
  }
}
