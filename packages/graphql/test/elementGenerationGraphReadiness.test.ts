import { KBGraphBuildStatus, type Prisma } from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import { isElementGenerationGraphBundleReady } from '../src/services/elementGenerationGraphReadiness.js'

const readyBuild = {
  status: KBGraphBuildStatus.SUCCEEDED,
  graphBundleContainerName: 'kg-graph-artifacts',
  graphBundleBlobPrefix: 'graph-artifacts/build/build',
  graphBundleStorageName: 'bundle-storage',
  graphBundleSha256: 'a'.repeat(64),
  graphSha256: 'b'.repeat(64),
  graphManifestSchemaVersion: 2,
  graphManifestArtifact: {
    containerName: 'graphs',
    blobName: 'manifest.json',
    sha256: 'c'.repeat(64),
  } satisfies Prisma.JsonObject,
}

describe('element generation graph readiness', () => {
  it('accepts a succeeded native graph build with a complete v2 bundle', () => {
    expect(isElementGenerationGraphBundleReady(readyBuild)).toBe(true)
  })

  it.each([
    { status: KBGraphBuildStatus.PROCESSING },
    { graphBundleContainerName: null },
    { graphBundleBlobPrefix: null },
    { graphBundleStorageName: null },
    { graphBundleSha256: null },
    { graphSha256: null },
    { graphManifestSchemaVersion: 1 },
    { graphManifestArtifact: null },
  ])('rejects an ineligible native build: %o', (override) => {
    expect(
      isElementGenerationGraphBundleReady({ ...readyBuild, ...override })
    ).toBe(false)
  })
})
