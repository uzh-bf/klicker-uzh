import { describe, expect, it } from 'vitest'

describe('package subpath exports', () => {
  it('loads the auth helpers through the public package path', async () => {
    const auth = await import('@klicker-uzh/util/auth')

    expect(auth.extractBearerToken('Bearer package-export')).toBe(
      'package-export'
    )
  })

  it('loads the client auth helpers through the public package path', async () => {
    const clientAuth = await import('@klicker-uzh/util/client-auth')

    expect(clientAuth.getStoredAuthToken('missing')).toBeNull()
  })

  it('loads citation helpers through the public package path', async () => {
    const citations = await import('@klicker-uzh/util/citations')

    expect(citations.extractCitationIndexes('Grounded [1].')).toEqual([1])
  })

  it('loads the KB transfer attestation contract through the public package path', async () => {
    const attestation = await import(
      '@klicker-uzh/util/knowledge-transfer-attestation'
    )

    expect(attestation.KB_TRANSFER_ATTESTATION_VERSION).toBeTypeOf('string')
    expect(attestation.isKbTransferAttestationCurrent).toBeTypeOf('function')
  })

  it('loads participant data-use helpers through the public package path', async () => {
    const dataUse = await import(
      '@klicker-uzh/util/participant-account-data-use'
    )

    expect(dataUse.PARTICIPANT_DATA_USE_DISCLOSURE_VERSION).toBeTypeOf('string')
    expect(dataUse.isParticipantDataUseComplete).toBeTypeOf('function')
  })

  it('loads response-example digest helpers through the public package path', async () => {
    const digest = await import('@klicker-uzh/util/response-example-digest')

    expect(digest.computeResponseExampleSetDigest).toBeTypeOf('function')
  })

  it('loads response-example eligibility helpers through the public package path', async () => {
    const eligibility = await import(
      '@klicker-uzh/util/response-example-eligibility'
    )

    expect(eligibility.evaluateResponseExampleCurrentEligibility).toBeTypeOf(
      'function'
    )
  })

  it('loads response-example runtime helpers through the public package path', async () => {
    const runtime = await import('@klicker-uzh/util/response-example-runtime')

    expect(runtime.buildResponseExampleSkillProjection).toBeTypeOf('function')
    expect(runtime.computeResponseExampleSkillProjectionDigest).toBeTypeOf(
      'function'
    )
  })
})
