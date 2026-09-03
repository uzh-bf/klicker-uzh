import { createHash, randomUUID } from 'node:crypto'
import {
  importPKCS8,
  importSPKI,
  type JWTPayload,
  jwtVerify,
  SignJWT,
} from 'jose'

export const RESPONSE_EXAMPLE_RECEIPT_ALGORITHM = 'ES256'
export const RESPONSE_EXAMPLE_RECEIPT_PURPOSE = 'response-example-capture'
export const RESPONSE_EXAMPLE_RECEIPT_VERSION = 1
export const RESPONSE_EXAMPLE_RECEIPT_TTL_SECONDS = 10 * 60
export const RESPONSE_EXAMPLE_RECEIPT_MAX_TOKEN_CHARACTERS = 32 * 1024
export const RESPONSE_EXAMPLE_RECEIPT_MAX_EVIDENCE_REFERENCES = 12

const CHAT_MODE_MAX_LENGTH = 100
const QUESTION_MAX_LENGTH = 4_000
const ANSWER_MAX_LENGTH = 20_000
const CHUNK_ID_MAX_LENGTH = 256
const CITATION_ANCHOR_MAX_LENGTH = 1_024
const SHA256_RE = /^[0-9a-f]{64}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ResponseExampleReceiptErrorCode =
  | 'CONFIGURATION'
  | 'EXPIRED'
  | 'INVALID'

export class ResponseExampleReceiptError extends Error {
  constructor(
    public readonly code: ResponseExampleReceiptErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ResponseExampleReceiptError'
  }
}

export interface ResponseExampleReceiptEvidence {
  citationIndex: number
  sourceId: string
  chunkId: string
  contentHash: string
  citationAnchor: string
}

export interface ResponseExampleReceiptClaims {
  version: typeof RESPONSE_EXAMPLE_RECEIPT_VERSION
  purpose: typeof RESPONSE_EXAMPLE_RECEIPT_PURPOSE
  ownerId: string
  chatbotId: string
  kbId: string
  chatMode: string
  questionHash: string
  answerHash: string
  evidenceReferences: readonly ResponseExampleReceiptEvidence[]
  issuedAt: number
  expiresAt: number
  jti: string
}

export interface ResponseExampleReceiptContent {
  ownerId: string
  chatbotId: string
  kbId: string
  chatMode: string
  question: string
  answer: string
  evidenceReferences: readonly ResponseExampleReceiptEvidence[]
}

export interface SignResponseExampleReceiptInput
  extends ResponseExampleReceiptContent {
  privateKeyPem: string
  keyId: string
  issuer: string
  audience: string
}

export interface VerifyResponseExampleReceiptInput {
  token: string
  publicKeyPem: string
  keyId: string
  issuer: string
  audience: string
}

interface ResponseExampleReceiptPayload extends JWTPayload {
  v?: unknown
  purpose?: unknown
  chatbot_id?: unknown
  kb_id?: unknown
  chat_mode?: unknown
  question_sha256?: unknown
  answer_sha256?: unknown
  evidence?: unknown
}

export function hashResponseExampleReceiptContent(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function requireConfiguredValue(value: string, name: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new ResponseExampleReceiptError(
      'CONFIGURATION',
      `${name} is not configured`
    )
  }
  return normalized
}

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ResponseExampleReceiptError('INVALID', `${field} is invalid`)
  }
  return value
}

function requireBoundedString(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    throw new ResponseExampleReceiptError('INVALID', `${field} is invalid`)
  }
  return value
}

function requireSha256(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    throw new ResponseExampleReceiptError('INVALID', `${field} is invalid`)
  }
  return value
}

function validateEvidenceReferences(
  value: unknown
): ResponseExampleReceiptEvidence[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > RESPONSE_EXAMPLE_RECEIPT_MAX_EVIDENCE_REFERENCES
  ) {
    throw new ResponseExampleReceiptError(
      'INVALID',
      'evidence references are invalid'
    )
  }

  const citationIndexes = new Set<number>()
  const references = value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ResponseExampleReceiptError(
        'INVALID',
        'evidence reference is invalid'
      )
    }
    const reference = entry as Record<string, unknown>
    const citationIndex = reference.citationIndex
    if (
      typeof citationIndex !== 'number' ||
      !Number.isInteger(citationIndex) ||
      citationIndex < 1 ||
      citationIndex > RESPONSE_EXAMPLE_RECEIPT_MAX_EVIDENCE_REFERENCES ||
      citationIndexes.has(citationIndex)
    ) {
      throw new ResponseExampleReceiptError(
        'INVALID',
        'citation index is invalid'
      )
    }
    citationIndexes.add(citationIndex)

    return {
      citationIndex,
      sourceId: requireUuid(reference.sourceId, 'source id'),
      chunkId: requireBoundedString(
        reference.chunkId,
        'chunk id',
        CHUNK_ID_MAX_LENGTH
      ),
      contentHash: requireSha256(reference.contentHash, 'content hash'),
      citationAnchor: requireBoundedString(
        reference.citationAnchor,
        'citation anchor',
        CITATION_ANCHOR_MAX_LENGTH
      ),
    }
  })

  return references.sort(
    (left, right) => left.citationIndex - right.citationIndex
  )
}

function validateReceiptContent(
  input: ResponseExampleReceiptContent
): ResponseExampleReceiptContent {
  return {
    ownerId: requireUuid(input.ownerId, 'owner id'),
    chatbotId: requireUuid(input.chatbotId, 'chatbot id'),
    kbId: requireUuid(input.kbId, 'knowledge base id'),
    chatMode: requireBoundedString(
      input.chatMode,
      'chat mode',
      CHAT_MODE_MAX_LENGTH
    ),
    question: requireBoundedString(
      input.question,
      'question',
      QUESTION_MAX_LENGTH
    ),
    answer: requireBoundedString(input.answer, 'answer', ANSWER_MAX_LENGTH),
    evidenceReferences: validateEvidenceReferences(input.evidenceReferences),
  }
}

export async function signResponseExampleReceipt(
  input: SignResponseExampleReceiptInput
): Promise<{ token: string; expiresAt: number }> {
  const content = validateReceiptContent(input)
  const privateKeyPem = requireConfiguredValue(
    input.privateKeyPem,
    'receipt private key'
  ).replaceAll('\\n', '\n')
  const keyId = requireConfiguredValue(input.keyId, 'receipt key id')
  const issuer = requireConfiguredValue(input.issuer, 'receipt issuer')
  const audience = requireConfiguredValue(input.audience, 'receipt audience')
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + RESPONSE_EXAMPLE_RECEIPT_TTL_SECONDS

  try {
    const privateKey = await importPKCS8(
      privateKeyPem,
      RESPONSE_EXAMPLE_RECEIPT_ALGORITHM
    )
    const token = await new SignJWT({
      v: RESPONSE_EXAMPLE_RECEIPT_VERSION,
      purpose: RESPONSE_EXAMPLE_RECEIPT_PURPOSE,
      chatbot_id: content.chatbotId,
      kb_id: content.kbId,
      chat_mode: content.chatMode,
      question_sha256: hashResponseExampleReceiptContent(content.question),
      answer_sha256: hashResponseExampleReceiptContent(content.answer),
      evidence: content.evidenceReferences,
    })
      .setProtectedHeader({
        alg: RESPONSE_EXAMPLE_RECEIPT_ALGORITHM,
        typ: 'JWT',
        kid: keyId,
      })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(content.ownerId)
      .setJti(randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(privateKey)

    if (token.length > RESPONSE_EXAMPLE_RECEIPT_MAX_TOKEN_CHARACTERS) {
      throw new ResponseExampleReceiptError('INVALID', 'receipt is too large')
    }
    return { token, expiresAt }
  } catch (error) {
    if (error instanceof ResponseExampleReceiptError) throw error
    throw new ResponseExampleReceiptError(
      'CONFIGURATION',
      'receipt signing failed'
    )
  }
}

export async function verifyResponseExampleReceipt(
  input: VerifyResponseExampleReceiptInput
): Promise<ResponseExampleReceiptClaims> {
  if (
    typeof input.token !== 'string' ||
    input.token.length === 0 ||
    input.token.length > RESPONSE_EXAMPLE_RECEIPT_MAX_TOKEN_CHARACTERS
  ) {
    throw new ResponseExampleReceiptError('INVALID', 'receipt is invalid')
  }

  const publicKeyPem = requireConfiguredValue(
    input.publicKeyPem,
    'receipt public key'
  ).replaceAll('\\n', '\n')
  const keyId = requireConfiguredValue(input.keyId, 'receipt key id')
  const issuer = requireConfiguredValue(input.issuer, 'receipt issuer')
  const audience = requireConfiguredValue(input.audience, 'receipt audience')

  try {
    const publicKey = await importSPKI(
      publicKeyPem,
      RESPONSE_EXAMPLE_RECEIPT_ALGORITHM
    )
    const verified = await jwtVerify(input.token, publicKey, {
      algorithms: [RESPONSE_EXAMPLE_RECEIPT_ALGORITHM],
      issuer,
      audience,
    })
    if (
      verified.protectedHeader.typ !== 'JWT' ||
      verified.protectedHeader.kid !== keyId
    ) {
      throw new ResponseExampleReceiptError('INVALID', 'receipt is invalid')
    }

    const payload = verified.payload as ResponseExampleReceiptPayload
    if (
      payload.v !== RESPONSE_EXAMPLE_RECEIPT_VERSION ||
      payload.purpose !== RESPONSE_EXAMPLE_RECEIPT_PURPOSE
    ) {
      throw new ResponseExampleReceiptError('INVALID', 'receipt is invalid')
    }
    const ownerId = requireUuid(payload.sub, 'owner id')
    const chatbotId = requireUuid(payload.chatbot_id, 'chatbot id')
    const kbId = requireUuid(payload.kb_id, 'knowledge base id')
    const chatMode = requireBoundedString(
      payload.chat_mode,
      'chat mode',
      CHAT_MODE_MAX_LENGTH
    )
    const questionHash = requireSha256(payload.question_sha256, 'question hash')
    const answerHash = requireSha256(payload.answer_sha256, 'answer hash')
    const evidenceReferences = validateEvidenceReferences(payload.evidence)
    const issuedAt = payload.iat
    const expiresAt = payload.exp
    const jti = requireUuid(payload.jti, 'receipt id')
    if (
      typeof issuedAt !== 'number' ||
      typeof expiresAt !== 'number' ||
      !Number.isInteger(issuedAt) ||
      !Number.isInteger(expiresAt) ||
      expiresAt <= issuedAt ||
      expiresAt - issuedAt > RESPONSE_EXAMPLE_RECEIPT_TTL_SECONDS
    ) {
      throw new ResponseExampleReceiptError('INVALID', 'receipt is invalid')
    }

    return {
      version: RESPONSE_EXAMPLE_RECEIPT_VERSION,
      purpose: RESPONSE_EXAMPLE_RECEIPT_PURPOSE,
      ownerId,
      chatbotId,
      kbId,
      chatMode,
      questionHash,
      answerHash,
      evidenceReferences,
      issuedAt,
      expiresAt,
      jti,
    }
  } catch (error) {
    if (error instanceof ResponseExampleReceiptError) throw error
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ERR_JWT_EXPIRED'
    ) {
      throw new ResponseExampleReceiptError('EXPIRED', 'receipt has expired')
    }
    throw new ResponseExampleReceiptError('INVALID', 'receipt is invalid')
  }
}
