import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  hashResponseExampleReceiptContent,
  RESPONSE_EXAMPLE_RECEIPT_MAX_EVIDENCE_REFERENCES,
  RESPONSE_EXAMPLE_RECEIPT_TTL_SECONDS,
  ResponseExampleReceiptError,
  type ResponseExampleReceiptEvidence,
  signResponseExampleReceipt,
  verifyResponseExampleReceipt,
} from '../src/responseExampleReceipt'

const OWNER_ID = '6757e679-0452-45fe-9c43-2e3f033e3e18'
const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const KB_ID = '7016810d-31e9-4b39-9529-cd46feb2fb63'
const SOURCE_ID = '33ec1c89-f892-4ab6-97cb-27ed037ec33d'
const CONTENT_HASH = 'b'.repeat(64)
const KEY_ID = 'response-example-test-key'
const ISSUER = 'https://chat.klicker.test'
const AUDIENCE = 'klicker-response-example-test'

let privateKeyPem: string
let publicKeyPem: string

const evidenceReference: ResponseExampleReceiptEvidence = {
  citationIndex: 1,
  sourceId: SOURCE_ID,
  chunkId: 'chunk-7',
  contentHash: CONTENT_HASH,
  citationAnchor: 'page=7',
}

function signingInput(overrides: Record<string, unknown> = {}) {
  return {
    privateKeyPem,
    keyId: KEY_ID,
    issuer: ISSUER,
    audience: AUDIENCE,
    ownerId: OWNER_ID,
    chatbotId: CHATBOT_ID,
    kbId: KB_ID,
    chatMode: 'tutor',
    question: 'Why does this happen?',
    answer: 'It follows from the source. [1]',
    evidenceReferences: [evidenceReference],
    ...overrides,
  }
}

describe('response-example receipt contract', () => {
  beforeAll(async () => {
    const keyPair = await generateKeyPair('ES256')
    privateKeyPem = await exportPKCS8(keyPair.privateKey)
    publicKeyPem = await exportSPKI(keyPair.publicKey)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('binds a short-lived ES256 receipt to exact content and evidence', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-03T12:00:00.000Z'))

    const signed = await signResponseExampleReceipt(signingInput())
    const claims = await verifyResponseExampleReceipt({
      token: signed.token,
      publicKeyPem,
      keyId: KEY_ID,
      issuer: ISSUER,
      audience: AUDIENCE,
    })

    expect(claims).toMatchObject({
      ownerId: OWNER_ID,
      chatbotId: CHATBOT_ID,
      kbId: KB_ID,
      chatMode: 'tutor',
      questionHash: hashResponseExampleReceiptContent('Why does this happen?'),
      answerHash: hashResponseExampleReceiptContent(
        'It follows from the source. [1]'
      ),
      evidenceReferences: [evidenceReference],
    })
    expect(claims.expiresAt - claims.issuedAt).toBe(
      RESPONSE_EXAMPLE_RECEIPT_TTL_SECONDS
    )
    expect(signed.expiresAt).toBe(claims.expiresAt)
  })

  it('rejects tampering and mismatched verifier identity', async () => {
    const signed = await signResponseExampleReceipt(signingInput())
    const segments = signed.token.split('.')
    const signature = segments[2]!
    const tampered = `${segments[0]}.${segments[1]}.${
      signature.startsWith('a') ? 'b' : 'a'
    }${signature.slice(1)}`

    await expect(
      verifyResponseExampleReceipt({
        token: tampered,
        publicKeyPem,
        keyId: KEY_ID,
        issuer: ISSUER,
        audience: AUDIENCE,
      })
    ).rejects.toMatchObject({ code: 'INVALID' })
    await expect(
      verifyResponseExampleReceipt({
        token: signed.token,
        publicKeyPem,
        keyId: 'another-key',
        issuer: ISSUER,
        audience: AUDIENCE,
      })
    ).rejects.toMatchObject({ code: 'INVALID' })
    await expect(
      verifyResponseExampleReceipt({
        token: signed.token,
        publicKeyPem,
        keyId: KEY_ID,
        issuer: 'https://another-issuer.test',
        audience: AUDIENCE,
      })
    ).rejects.toMatchObject({ code: 'INVALID' })
    await expect(
      verifyResponseExampleReceipt({
        token: signed.token,
        publicKeyPem,
        keyId: KEY_ID,
        issuer: ISSUER,
        audience: 'another-service',
      })
    ).rejects.toMatchObject({ code: 'INVALID' })
  })

  it('reports an expired receipt separately', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-03T12:00:00.000Z'))
    const signed = await signResponseExampleReceipt(signingInput())

    vi.setSystemTime(
      new Date(Date.now() + (RESPONSE_EXAMPLE_RECEIPT_TTL_SECONDS + 1) * 1_000)
    )
    await expect(
      verifyResponseExampleReceipt({
        token: signed.token,
        publicKeyPem,
        keyId: KEY_ID,
        issuer: ISSUER,
        audience: AUDIENCE,
      })
    ).rejects.toMatchObject({ code: 'EXPIRED' })
  })

  it('reports an invalid verification key as configuration', async () => {
    const signed = await signResponseExampleReceipt(signingInput())

    await expect(
      verifyResponseExampleReceipt({
        token: signed.token,
        publicKeyPem: 'not-a-public-key',
        keyId: KEY_ID,
        issuer: ISSUER,
        audience: AUDIENCE,
      })
    ).rejects.toMatchObject({ code: 'CONFIGURATION' })
  })

  it('rejects unbounded or incomplete claims before signing', async () => {
    const tooManyReferences = Array.from(
      { length: RESPONSE_EXAMPLE_RECEIPT_MAX_EVIDENCE_REFERENCES + 1 },
      (_, index) => ({
        ...evidenceReference,
        citationIndex: index + 1,
        chunkId: `chunk-${index + 1}`,
      })
    )

    await expect(
      signResponseExampleReceipt(
        signingInput({ evidenceReferences: tooManyReferences })
      )
    ).rejects.toBeInstanceOf(ResponseExampleReceiptError)
    await expect(
      signResponseExampleReceipt(signingInput({ answer: '' }))
    ).rejects.toMatchObject({ code: 'INVALID' })
    await expect(
      signResponseExampleReceipt(
        signingInput({
          evidenceReferences: [{ ...evidenceReference, contentHash: 'short' }],
        })
      )
    ).rejects.toMatchObject({ code: 'INVALID' })
  })
})
