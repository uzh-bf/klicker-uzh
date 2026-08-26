import { describe, expect, it } from 'vitest'
import {
  expectedKBGraphManifestBlobName,
  getKBGraphBundleCoordinates,
} from '../src/services/kbGraphBundleCoordinates.js'

const BUILD_ID = '123e4567-e89b-42d3-a456-426614174000'

describe('KB graph bundle coordinates', () => {
  it('pins one shared private container and a build-specific prefix', () => {
    expect(
      getKBGraphBundleCoordinates(BUILD_ID, {
        KB_GRAPH_ARTIFACT_CONTAINER: 'kg-shared-artifacts',
        KB_GRAPH_ARTIFACT_PREFIX: 'native-graphs',
      })
    ).toEqual({
      containerName: 'kg-shared-artifacts',
      blobPrefix: `native-graphs/${BUILD_ID}/${BUILD_ID}`,
      storageName: BUILD_ID,
    })
  })

  it('derives the exact digest-specific manifest coordinate', () => {
    const digest = 'a'.repeat(64)
    expect(
      expectedKBGraphManifestBlobName(
        `native-graphs/${BUILD_ID}/${BUILD_ID}`,
        digest
      )
    ).toBe(`native-graphs/${BUILD_ID}/${BUILD_ID}/${digest}/manifest.json`)
    expect(
      expectedKBGraphManifestBlobName('../native-graphs', digest)
    ).toBeNull()
    expect(
      expectedKBGraphManifestBlobName(
        `native-graphs/${BUILD_ID}/${BUILD_ID}`,
        'not-a-digest'
      )
    ).toBeNull()
  })
})
