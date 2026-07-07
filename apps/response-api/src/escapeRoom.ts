import {
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import { hatchetClient } from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import { verifyJWT, type JWTPayload } from '@klicker-uzh/util'
import { randomUUID } from 'crypto'
import { IncomingMessage, ServerResponse } from 'http'
import { Redis } from 'ioredis'

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
    } else if (parsedCookies['temporary_participant_token'] !== undefined) {
      const payload = await verifyJWT(
        parsedCookies['temporary_participant_token'],
        process.env.APP_SECRET as string
      )
      if (payload.role === 'TEMPORARY_PARTICIPANT') return payload
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
  let attempt = await prisma.escapeRoomAttempt.findUnique({
    where: {
      participantId_elementBlockId: {
        participantId: participantData.sub,
        elementBlockId: blockId,
      },
    },
  })

  if (!attempt) {
    const timeLimit = Number(instanceInfo.escapeRoomTimeLimit || 300)
    attempt = await prisma.escapeRoomAttempt.create({
      data: {
        timeLimit,
        penaltySeconds: 0,
        hintsUsed: [],
        status: 'IN_PROGRESS',
        participantId: participantData.sub,
        elementBlockId: blockId,
      },
    })
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
  if (elapsed > totalLimit) {
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
  const parsedSolutions = instanceInfo.solutions
    ? JSON.parse(instanceInfo.solutions)
    : undefined

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
    const exactSolutionsDefined =
      typeof parsedSolutions !== 'undefined' &&
      parsedSolutions.length > 0 &&
      (typeof parsedSolutions[0] === 'number' ||
        typeof parsedSolutions[0] === 'string')
    pointsPercentage =
      gradeQuestionNumerical({
        response: Number(response.value),
        solutionRanges: exactSolutionsDefined ? undefined : parsedSolutions,
        exactSolutions: exactSolutionsDefined ? parsedSolutions : undefined,
      }) || 0
  } else if (type === 'FREE_TEXT') {
    pointsPercentage =
      gradeQuestionFreeText({
        response: (response.value || '').trim(),
        solutions: parsedSolutions || [],
      }) || 0
  }

  const isCorrect = pointsPercentage === 1
  const triesKey = `lq:${liveQuizId}:i:${instanceId}:tries:${participantData.sub}`

  if (isCorrect) {
    // Correct! Fetch tries and send event to Hatchet to save
    const triesRaw = await redis.get(triesKey)
    const tries = triesRaw ? Number(triesRaw) + 1 : 1
    await redis.del(triesKey)

    const responseTimestamp = Date.now()
    const message = {
      messageId: randomUUID(),
      sessionId: String(liveQuizId),
      instanceId: String(instanceId),
      response,
      cookie,
      responseTimestamp,
      tries,
    }

    const isAuthenticatedParticipant =
      cookie &&
      (cookie.includes('participant_token=') ||
        cookie.includes('temporary_participant_token='))

    const eventName = isAuthenticatedParticipant
      ? 'response-received:authenticated'
      : 'response-received:anonymous'

    await hatchetClient.events.push(eventName, message)
    sendJson(res, 200, { status: 'correct', responseTimestamp })
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
