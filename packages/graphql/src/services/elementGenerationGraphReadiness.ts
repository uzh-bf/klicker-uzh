import * as DB from '@klicker-uzh/prisma/client'

export interface ElementGenerationGraphBundle {
  status: DB.KBGraphBuildStatus
  graphBundleContainerName: string | null
  graphBundleBlobPrefix: string | null
  graphBundleStorageName: string | null
  graphBundleSha256: string | null
  graphSha256: string | null
  graphManifestSchemaVersion: number | null
  graphManifestArtifact: DB.Prisma.JsonValue | null
}

type ReadyElementGenerationGraphBundle<T extends ElementGenerationGraphBundle> =
  T & {
    status: typeof DB.KBGraphBuildStatus.SUCCEEDED
    graphBundleContainerName: string
    graphBundleBlobPrefix: string
    graphBundleStorageName: string
    graphBundleSha256: string
    graphSha256: string
    graphManifestSchemaVersion: 2
    graphManifestArtifact: Exclude<T['graphManifestArtifact'], null>
  }

export function isElementGenerationGraphBundleReady<
  T extends ElementGenerationGraphBundle,
>(build: T | null | undefined): build is ReadyElementGenerationGraphBundle<T> {
  return (
    build?.status === DB.KBGraphBuildStatus.SUCCEEDED &&
    build.graphBundleContainerName !== null &&
    build.graphBundleBlobPrefix !== null &&
    build.graphBundleStorageName !== null &&
    build.graphBundleSha256 !== null &&
    build.graphSha256 !== null &&
    build.graphManifestSchemaVersion === 2 &&
    build.graphManifestArtifact !== null
  )
}
