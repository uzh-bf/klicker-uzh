import { createHmac, timingSafeEqual } from 'node:crypto'

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true })

type StrictSignedCanonicalPayloadCodecOptions<Payload extends object> = {
  signingContext: readonly (string | number)[]
  maxEncodedPayloadLength: number
  maxEncodedSignatureLength: number
  maxTokenLength: number
  canonicalize: (value: unknown) => Payload | null
}

export type StrictSignedCanonicalPayloadCodec<Payload extends object> =
  Readonly<{
    sign: (payload: Payload, secret: string) => string | null
    parse: (token: string, secret: string) => Payload | null
  }>

function decodeBase64UrlStrict(value: string, maxLength: number) {
  if (
    value.length === 0 ||
    value.length > maxLength ||
    !BASE64URL_PATTERN.test(value)
  ) {
    return null
  }

  const decoded = Buffer.from(value, 'base64url')
  return decoded.toString('base64url') === value ? decoded : null
}

/**
 * Creates an internal codec for one signed canonical-JSON payload contract.
 * Domain-specific validation remains in the supplied canonicalizer; this
 * codec owns only framing, bounded encoding, signing, and strict decoding.
 */
export function createStrictSignedCanonicalPayloadCodec<Payload extends object>(
  options: StrictSignedCanonicalPayloadCodecOptions<Payload>
): StrictSignedCanonicalPayloadCodec<Payload> {
  const signingPrefix = options.signingContext.map(String).join('\0')

  function computeSignature(encodedPayload: string, secret: string) {
    return createHmac('sha256', secret)
      .update(`${signingPrefix}\0${encodedPayload}`)
      .digest()
  }

  function signaturesMatch(encodedSignature: string, expected: Buffer) {
    const provided =
      decodeBase64UrlStrict(
        encodedSignature,
        options.maxEncodedSignatureLength
      ) ?? Buffer.alloc(0)
    const fixedLengthProvided = Buffer.alloc(expected.length)
    provided.copy(
      fixedLengthProvided,
      0,
      0,
      Math.min(provided.length, expected.length)
    )

    // timingSafeEqual requires equal-length inputs. Always compare a fixed-size
    // buffer, then separately require the exact expected signature length.
    const equalContent = timingSafeEqual(fixedLengthProvided, expected)
    return provided.length === expected.length && equalContent
  }

  function sign(payload: Payload, secret: string) {
    const serializedPayload = JSON.stringify(payload)
    const encodedPayload = Buffer.from(serializedPayload, 'utf8').toString(
      'base64url'
    )
    if (encodedPayload.length > options.maxEncodedPayloadLength) return null

    const signature = computeSignature(encodedPayload, secret).toString(
      'base64url'
    )
    const token = `${encodedPayload}.${signature}`
    return token.length <= options.maxTokenLength ? token : null
  }

  function parse(token: string, secret: string): Payload | null {
    if (token.length === 0 || token.length > options.maxTokenLength) {
      return null
    }

    const separator = token.indexOf('.')
    if (
      separator <= 0 ||
      separator !== token.lastIndexOf('.') ||
      separator === token.length - 1
    ) {
      return null
    }

    const encodedPayload = token.slice(0, separator)
    const encodedSignature = token.slice(separator + 1)
    const payloadBuffer = decodeBase64UrlStrict(
      encodedPayload,
      options.maxEncodedPayloadLength
    )
    if (!payloadBuffer) return null

    const expectedSignature = computeSignature(encodedPayload, secret)
    if (!signaturesMatch(encodedSignature, expectedSignature)) return null

    const serializedPayload = UTF8_DECODER.decode(payloadBuffer)
    const payload = options.canonicalize(
      JSON.parse(serializedPayload) as unknown
    )

    return payload && JSON.stringify(payload) === serializedPayload
      ? payload
      : null
  }

  return { sign, parse }
}
