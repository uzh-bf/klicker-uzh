import type { StudentMcpQuestionRefPayload as QuestionRefPayload } from '@klicker-uzh/types'
import { createHmac, timingSafeEqual } from 'node:crypto'

export type QuestionRefCodecOptions = {
  secret: string
  ttlSeconds: number
}

type SignedQuestionRefPayload = QuestionRefPayload & {
  sub: string
  purpose: 'student-practice-stack-ref'
  version: 1
  iat: number
  exp: number
}

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function decodePayload(token: string): SignedQuestionRefPayload {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Invalid questionRef format')
  }

  const raw = JSON.parse(decodeBase64Url(parts[1])) as unknown
  if (!isRecord(raw)) {
    throw new Error('Invalid questionRef payload')
  }

  return raw as SignedQuestionRefPayload
}

export function createQuestionRefSync(
  payload: QuestionRefPayload,
  options: QuestionRefCodecOptions
): string {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = encodeBase64Url(
    JSON.stringify({
      ...payload,
      sub: payload.participantId,
      purpose: 'student-practice-stack-ref',
      version: 1,
      iat: nowSeconds,
      exp: nowSeconds + options.ttlSeconds,
    } satisfies SignedQuestionRefPayload)
  )
  const signingInput = `${header}.${body}`
  return `${signingInput}.${sign(signingInput, options.secret)}`
}

export function getQuestionRefExpiresAt(token: string): string {
  const payload = decodePayload(token)
  return new Date(payload.exp * 1000).toISOString()
}

export async function verifyQuestionRef(
  token: string,
  expected: Partial<
    Pick<QuestionRefPayload, 'participantId' | 'chatbotId' | 'courseId'>
  >,
  options: Pick<QuestionRefCodecOptions, 'secret'>
): Promise<QuestionRefPayload> {
  const parts = token.split('.')
  const signingInput = `${parts[0]}.${parts[1]}`
  const expectedSignature = sign(signingInput, options.secret)
  const actualSignature = parts[2] ?? ''

  const expectedBuffer = Buffer.from(expectedSignature)
  const actualBuffer = Buffer.from(actualSignature)
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error('Invalid questionRef signature')
  }

  const payload = decodePayload(token)
  if (
    payload.purpose !== 'student-practice-stack-ref' ||
    payload.version !== 1 ||
    payload.sub !== payload.participantId
  ) {
    throw new Error('Invalid questionRef payload')
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('questionRef has expired')
  }

  for (const key of ['participantId', 'chatbotId', 'courseId'] as const) {
    if (expected[key] && payload[key] !== expected[key]) {
      throw new Error(`questionRef ${key} does not match request context`)
    }
  }

  return {
    participantId: payload.participantId,
    chatbotId: payload.chatbotId,
    courseId: payload.courseId,
    stackId: payload.stackId,
    orderedElements: payload.orderedElements,
  }
}
