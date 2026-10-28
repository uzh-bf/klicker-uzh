import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  QUESTION_PARTIAL_RESULTS_ENABLED,
  questionWorkflowPayload,
  questionWorkflowStartManifestSha256,
  questionWorkflowStartPayload,
} from '../src/services/questionGeneration.js'

const buildId = '123e4567-e89b-42d3-a456-426614174000'
const graphBuildId = '223e4567-e89b-42d3-a456-426614174000'

function startPayloadInput() {
  return {
    buildId,
    graphVersionId: graphBuildId,
    graphManifest: {
      containerName: 'kg-graph-artifacts',
      blobName: `graph-artifacts/${graphBuildId}/manifest.json`,
      sha256: 'c'.repeat(64),
    },
    storageName: graphBuildId,
    blueprint: {
      containerName: 'question-inputs',
      blobName: `question-builds/${buildId}/blueprints/blueprint_input.json`,
      sha256: 'a'.repeat(64),
    },
    output: {
      containerName: 'question-results',
      blobPrefix: 'question-builds',
    },
    language: 'de' as const,
  }
}

describe('question-generation partial-result rollout gate', () => {
  it('follows the rollout gate for the default start payload', () => {
    const payload = questionWorkflowStartPayload(startPayloadInput())
    const gated = questionWorkflowStartPayload(startPayloadInput(), {
      allowPartialResults: QUESTION_PARTIAL_RESULTS_ENABLED,
    })

    expect(payload).toEqual(gated)
    expect(Object.hasOwn(payload, 'allow_partial_results')).toBe(
      QUESTION_PARTIAL_RESULTS_ENABLED
    )
  })

  it('omits the capability key entirely for a strict build', () => {
    const payload = questionWorkflowStartPayload(startPayloadInput(), {
      allowPartialResults: false,
    })

    // The worker drops an absent key before it hashes, so the key must be
    // absent, not merely false; that is also what keeps the start-manifest
    // hash of every build dispatched before the gate was raised byte-identical.
    expect(Object.hasOwn(payload, 'allow_partial_results')).toBe(false)
    expect(Object.keys(payload).sort()).toEqual([
      'blueprint',
      'graph_manifest',
      'graph_version_id',
      'language',
      'output',
      'question_build_id',
      'schema_version',
      'storage_name',
    ])
  })

  it('changes the start-manifest hash when the capability is emitted', () => {
    const strict = questionWorkflowStartPayload(startPayloadInput(), {
      allowPartialResults: false,
    })
    const partial = questionWorkflowStartPayload(startPayloadInput(), {
      allowPartialResults: true,
    })

    expect(partial.allow_partial_results).toBe(true)
    expect(questionWorkflowStartManifestSha256(partial)).not.toBe(
      questionWorkflowStartManifestSha256(strict)
    )
  })

  it('uses payload v4 only when an immutable library snapshot is present', () => {
    const input = startPayloadInput()
    const legacy = questionWorkflowStartPayload(input, {
      allowPartialResults: false,
    })
    const withLibrary = questionWorkflowStartPayload(
      {
        ...input,
        librarySnapshot: {
          containerName: 'question-inputs',
          blobName: `question-builds/${buildId}/library-snapshots/${'d'.repeat(64)}.json`,
          sha256: 'd'.repeat(64),
        },
      },
      { allowPartialResults: false }
    )

    expect(legacy.schema_version).toBe(3)
    expect(withLibrary).toMatchObject({
      schema_version: 4,
      question_library_snapshot: {
        container_name: 'question-inputs',
        blob_name: `question-builds/${buildId}/library-snapshots/${'d'.repeat(64)}.json`,
        sha256: 'd'.repeat(64),
      },
    })
    expect(questionWorkflowStartManifestSha256(withLibrary)).not.toBe(
      questionWorkflowStartManifestSha256(legacy)
    )
  })

  it('recomputes the exact dispatched v4 manifest from pinned build inputs', () => {
    const input = startPayloadInput()
    const librarySnapshot = {
      containerName: 'question-inputs',
      blobName: `question-builds/${buildId}/library-snapshots/${'d'.repeat(64)}.json`,
      sha256: 'd'.repeat(64),
    }
    const dispatched = questionWorkflowStartPayload({
      ...input,
      librarySnapshot,
    })
    const recomputed = questionWorkflowPayload(
      {
        id: buildId,
        blueprintArtifact: input.blueprint,
        librarySnapshotArtifact: librarySnapshot,
        configuration: { language: input.language },
        sourceGraphBuild: {
          id: graphBuildId,
          graphManifestArtifact: input.graphManifest,
          graphBundleStorageName: input.storageName,
        },
      } as never,
      {
        questionOutputContainer: input.output.containerName,
        questionOutputPrefix: input.output.blobPrefix,
      } as never
    )

    expect(recomputed).toEqual(dispatched)
    expect(questionWorkflowStartManifestSha256(recomputed)).toBe(
      questionWorkflowStartManifestSha256(dispatched)
    )
  })

  it('keeps the legacy start-manifest hash stable for a strict build', () => {
    const input = startPayloadInput()
    const payload = questionWorkflowStartPayload(input, {
      allowPartialResults: false,
    })

    // Regression guard for the provenance contract: the dispatched hash and
    // the hash recomputed during plan synchronization must keep matching the
    // shape every already-deployed build was created with. The expected value
    // is written out literally rather than produced by the builder, so any new
    // emitted key changes one side of this assertion.
    const legacyPayload = {
      schema_version: 3 as const,
      question_build_id: input.buildId,
      graph_version_id: input.graphVersionId,
      graph_manifest: {
        container_name: input.graphManifest.containerName,
        blob_name: input.graphManifest.blobName,
        sha256: input.graphManifest.sha256,
      },
      storage_name: input.storageName,
      blueprint: {
        container_name: input.blueprint.containerName,
        blob_name: input.blueprint.blobName,
        sha256: input.blueprint.sha256,
      },
      output: {
        container_name: input.output.containerName,
        blob_prefix: input.output.blobPrefix,
      },
      language: input.language,
    }

    expect(questionWorkflowStartManifestSha256(payload)).toBe(
      questionWorkflowStartManifestSha256(legacyPayload)
    )
  })

  it('is not enabled by any production call site', () => {
    const servicesDirectory = new URL('../src/services/', import.meta.url)
    const sources = readdirSync(servicesDirectory)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => readFileSync(new URL(name, servicesDirectory), 'utf8'))

    // The override exists for tests only. A production caller that passed it
    // would move the emission decision out of the constant that owns the
    // rollout, so the absence of an enabling call site is the guarantee.
    expect(
      sources.filter((source) => source.includes('allowPartialResults: true'))
    ).toEqual([])
  })
})
