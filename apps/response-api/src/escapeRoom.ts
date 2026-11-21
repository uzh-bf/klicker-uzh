import {
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import { hatchetClient } from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import {
  ESCAPE_ROOM_SUPPORTED_ELEMENT_TYPES,
  getCurrentEscapeRoomInstance,
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

  if (attempt.status !== 'IN_PROGRESS') {
    sendJson(res, 400, { error: 'escape_room_not_in_progress' })
    return true
  }

  if (
    attempt.lockoutUntil &&
    Date.now() < new Date(attempt.lockoutUntil).getTime()
  ) {
    sendJson(res, 429, {
      status: 'lockout',
      lockoutUntil: attempt.lockoutUntil,
    })
    return true
  }

  if (isEscapeRoomExpired(attempt)) {
    await prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: { status: 'EXPIRED' },
    })
    sendJson(res, 400, { error: 'escape_room_expired' })
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
  const clearedKey = `escape-attempt:${attempt.id}:cleared`
  let clearedInstances = new Set(await redis.smembers(clearedKey))
  let instanceAlreadyCleared = clearedInstances.has(String(instanceId))
  const currentInstance = getCurrentEscapeRoomInstance(
    requiredInstances,
    clearedInstances
  )
  if (!instanceAlreadyCleared && currentInstance?.id !== instanceId) {
    sendJson(res, 409, { error: 'escape_room_stage_locked' })
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

    const currentAttempt = await prisma.escapeRoomAttempt.findUnique({
      where: { id: attempt.id },
    })
    if (!currentAttempt || currentAttempt.status !== 'IN_PROGRESS') {
      sendJson(res, 400, { error: 'escape_room_not_in_progress' })
      return true
    }
    if (
      currentAttempt.lockoutUntil &&
      Date.now() < new Date(currentAttempt.lockoutUntil).getTime()
    ) {
      sendJson(res, 429, {
        status: 'lockout',
        lockoutUntil: currentAttempt.lockoutUntil,
      })
      return true
    }
    if (isEscapeRoomExpired(currentAttempt)) {
      await prisma.escapeRoomAttempt.updateMany({
        where: { id: currentAttempt.id, status: 'IN_PROGRESS' },
        data: { status: 'EXPIRED' },
      })
      sendJson(res, 400, { error: 'escape_room_expired' })
      return true
    }
    clearedInstances = new Set(await redis.smembers(clearedKey))
    instanceAlreadyCleared = clearedInstances.has(String(instanceId))
    if (instanceAlreadyCleared) {
      const blockCompleted =
        requiredInstances.length > 0 &&
        requiredInstances.every((entry) =>
          clearedInstances.has(String(entry.id))
        )
      if (blockCompleted) {
        await prisma.escapeRoomAttempt.updateMany({
          where: { id: currentAttempt.id, status: 'IN_PROGRESS' },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            lockoutUntil: null,
          },
        })
      }
      sendJson(res, 200, {
        status: 'correct',
        completed: blockCompleted,
        responseTimestamp: Date.now(),
      })
      return true
    }
    const claimedCurrentInstance = getCurrentEscapeRoomInstance(
      requiredInstances,
      clearedInstances
    )
    if (claimedCurrentInstance?.id !== instanceId) {
      sendJson(res, 409, { error: 'escape_room_stage_locked' })
      return true
    }

    // Grade response
    let pointsPercentage = 0
    let parsedSolutions: any = undefined
    if (instanceInfo.solutions) {
      try {
        parsedSolutions = JSON.parse(instanceInfo.solutions)
      } catch (e) {
        sendJson(res, 400, { error: 'invalid_solutions_json' })
        return true
      }
    }

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
      await redis.sadd(clearedKey, String(instanceId))
      clearedInstances.add(String(instanceId))
      await redis.expire(clearedKey, 60 * 60 * 24 * 30)
      await redis.del(triesKey)

      const blockCompleted =
        requiredInstances.length > 0 &&
        requiredInstances.every((entry) =>
          clearedInstances.has(String(entry.id))
        )

      if (blockCompleted) {
        await prisma.escapeRoomAttempt.updateMany({
          where: { id: attempt.id, status: 'IN_PROGRESS' },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            lockoutUntil: null,
          },
        })
      }
      sendJson(res, 200, {
        status: 'correct',
        completed: blockCompleted,
        responseTimestamp,
      })
      return true
    } else {
      // Incorrect! Apply lockout and increment tries
      await redis
        .multi()
        .incr(triesKey)
        .expire(triesKey, 60 * 60 * 24 * 30)
        .exec()
      const lockoutSeconds = Number(instanceInfo.escapeRoomLockoutSeconds || 0)
      let lockoutUntil: Date | null = null

      if (lockoutSeconds > 0) {
        lockoutUntil = new Date(Date.now() + lockoutSeconds * 1000)
        await prisma.escapeRoomAttempt.update({
          where: { id: attempt.id },
          data: { lockoutUntil },
        })
      }

      sendJson(res, 200, {
        status: 'incorrect',
        lockoutUntil,
        responseTimestamp: Date.now(),
      })
      return true
    }
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
