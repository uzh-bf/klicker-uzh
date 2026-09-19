import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  QUESTION_PARTIAL_RESULTS_ENABLED,
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
  it('keeps the partial-result capability disabled by default', () => {
    expect(QUESTION_PARTIAL_RESULTS_ENABLED).toBe(false)
  })

  it('omits the capability key entirely while the gate is closed', () => {
    const payload = questionWorkflowStartPayload(startPayloadInput())

    // The deployed worker rejects unknown start-payload fields, so the key
    // must be absent, not merely false; an absent key is also what keeps the
    // start-manifest hash of every legacy build byte-identical.
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

  it('emits the capability and changes the start-manifest hash when overridden', () => {
    const legacy = questionWorkflowStartPayload(startPayloadInput())
    const partial = questionWorkflowStartPayload(startPayloadInput(), {
      allowPartialResults: true,
    })

    expect(partial.allow_partial_results).toBe(true)
    expect(questionWorkflowStartManifestSha256(partial)).not.toBe(
      questionWorkflowStartManifestSha256(legacy)
    )
  })

  it('keeps the legacy start-manifest hash stable', () => {
    const input = startPayloadInput()
    const payload = questionWorkflowStartPayload(input)

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

    // The override exists for tests only. Any production caller that passed it
    // would silently enable a capability the deployed worker rejects, so the
    // absence of an enabling call site is the actual rollout guarantee.
    expect(
      sources.filter((source) => source.includes('allowPartialResults: true'))
    ).toEqual([])
  })
})
