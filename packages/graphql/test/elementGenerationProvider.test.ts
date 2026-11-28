import { describe, expect, it } from 'vitest'
import {
  canonicalElementGenerationJson,
  elementGenerationArtifactPayload,
  elementGenerationOutputBlobName,
  normalizeElementGenerationIdempotencyKey,
} from '../src/services/elementGenerationProvider.js'
import type { QuestionGenerationRuntime } from '../src/services/questionGenerationRuntime.js'

describe('element-generation provider boundary', () => {
  it('normalizes idempotency keys once for every provider adapter', () => {
    expect(normalizeElementGenerationIdempotencyKey('  request-1  ')).toBe(
      'request-1'
    )
    expect(() => normalizeElementGenerationIdempotencyKey('   ')).toThrowError(
      expect.objectContaining({ code: 'CONFIGURATION_INVALID' })
    )
  })

  it('canonicalizes nested payloads deterministically', () => {
    expect(
      JSON.stringify(
        canonicalElementGenerationJson({ z: 1, a: { y: 2, b: 3 } })
      )
    ).toBe('{"a":{"b":3,"y":2},"z":1}')
  })

  it('maps immutable artifacts and output paths at the shared seam', () => {
    expect(
      elementGenerationArtifactPayload({
        containerName: 'input',
        blobName: 'graphs/manifest.json',
        sha256: 'abc',
      })
    ).toEqual({
      container_name: 'input',
      blob_name: 'graphs/manifest.json',
      sha256: 'abc',
    })
    expect(
      elementGenerationOutputBlobName(
        { questionOutputPrefix: 'generated' } as QuestionGenerationRuntime,
        'build-1',
        'manifest/result.json'
      )
    ).toBe('generated/build-1/manifest/result.json')
  })
})
