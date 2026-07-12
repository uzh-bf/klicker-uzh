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
  gradeQrScanResponse,
  isValidQrScanCode,
  normalizeQrScanCode,
} from '@klicker-uzh/types'
import { verifyJWT, type JWTPayload } from '@klicker-uzh/util'
import { IncomingMessage, ServerResponse } from 'http'
import { Redis } from 'ioredis'

const ESCAPE_ROOM_GRACE_SECONDS = 5
const ESCAPE_ROOM_RESPONSE_TYPES = [
  'SC',
  'MC',
  'KPRIM',
  'NUMERICAL',
  'FREE_TEXT',
  'QR_SCAN',
] as const

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

export async function handleEscapeRoomValidation(
  req: IncomingMessage,
  res: ServerResponse,
  payload: { response: any; liveQuizId: string; instanceId: number },
  cookie: string | undefined,
  instanceInfo: Record<string, string>,
  redis: Redis
): Promise<boolean> {
  if (instanceInfo.isEscapeRoom !== 'true') {
    return false
  }

  const { response, liveQuizId, instanceId } = payload

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

  const instance = await prisma.elementInstance.findUnique({
    where: { id: instanceId },
    select: {
      elementBlockId: true,
      elementBlock: { select: { liveQuizId: true } },
      element: { select: { qrScanCode: true } },
    },
  })
  if (
    !instance ||
    instance.elementBlockId !== blockId ||
    instance.elementBlock?.liveQuizId !== liveQuizId
  ) {
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

  const elapsed = (Date.now() - new Date(attempt.startedAt).getTime()) / 1000
  const totalLimit = attempt.timeLimit - attempt.penaltySeconds
  if (elapsed > totalLimit + ESCAPE_ROOM_GRACE_SECONDS) {
    await prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: { status: 'EXPIRED' },
    })
    sendJson(res, 400, { error: 'escape_room_expired' })
    return true
  }

  // Grade response
  let pointsPercentage = 0
  const type = instanceInfo.type
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
    pointsPercentage = gradeQrScanResponse(instance.element.qrScanCode, code)
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
    const clearedKey = `escape-attempt:${attempt.id}:cleared`
    const claimKey = `${clearedKey}:claim:${instanceId}`
    const instanceAlreadyCleared =
      (await redis.sismember(clearedKey, String(instanceId))) === 1

    if (!instanceAlreadyCleared) {
      const claimed = await redis.set(claimKey, '1', 'EX', 300, 'NX')
      if (claimed !== 'OK') {
        sendJson(res, 409, { error: 'escape_room_response_processing' })
        return true
      }
    }

    const message = {
      messageId: `escape:${attempt.id}:${instanceId}`,
      sessionId: String(liveQuizId),
      instanceId: String(instanceId),
      response,
      cookie,
      responseTimestamp,
      tries,
    }

    if (!instanceAlreadyCleared) {
      try {
        await hatchetClient.events.push(
          'response-received:authenticated',
          message
        )
        await redis.sadd(clearedKey, String(instanceId))
        await redis.expire(clearedKey, 60 * 60 * 24 * 30)
        await redis.del(triesKey)
      } catch (error) {
        await redis.del(claimKey)
        throw error
      }
    }

    const requiredInstances = await prisma.elementInstance.findMany({
      where: {
        elementBlockId: blockId,
        elementType: { in: [...ESCAPE_ROOM_RESPONSE_TYPES] },
      },
      select: { id: true },
    })
    const clearedInstances = new Set(await redis.smembers(clearedKey))
    const blockCompleted =
      requiredInstances.length > 0 &&
      requiredInstances.every((entry) => clearedInstances.has(String(entry.id)))

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
    await redis.incr(triesKey)
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
}
