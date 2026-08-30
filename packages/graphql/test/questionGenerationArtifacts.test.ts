import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type {
  KBGraphSourceSnapshot,
  QuestionGenerationConfiguration,
} from '@klicker-uzh/types'
import {
  deriveGeneratedQuestionName,
  parseQuestionGenerationDesign,
  parseQuestionGenerationFinalBank,
  parseQuestionGenerationGraphManifest,
  parseQuestionGenerationPlan,
  parseQuestionGenerationProvenanceIndex,
  parseQuestionGenerationResult,
  verifyQuestionGenerationProvenanceAuthority,
} from '../src/services/questionGenerationArtifacts.js'
import { questionGenerationSourceSnapshot } from '../src/services/questionGenerationGraph.js'

const BUILD_ID = '123e4567-e89b-42d3-a456-426614174000'
const RESOURCE_ID = '81bf28ea-4bdc-4ee3-a087-8cba68a8df5a'
const NODE_ID = `node_${'a'.repeat(32)}`
const OTHER_NODE_ID = `node_${'b'.repeat(32)}`
const RELATIONSHIP_ID = `rel_${'c'.repeat(32)}`
const GRAPH_VERSION_ID = 'graph-version-1'
const KPRIM_GOLDEN_BANK = readFileSync(
  new URL(
    './fixtures/questionGeneration/kprim-question-bank-v1.json',
    import.meta.url
  )
)
const MC_GOLDEN_BANK = readFileSync(
  new URL(
    './fixtures/questionGeneration/mc-question-bank-v1.json',
    import.meta.url
  )
)
const sourceSnapshot: KBGraphSourceSnapshot = [
  {
    resourceId: RESOURCE_ID,
    title: 'Wine chemistry',
    sourceFile: 'wine-chemistry.pdf',
    contentSha256: 'd'.repeat(64),
    resourceVersion: 1,
    pageCount: 12,
  },
]
const configuration: QuestionGenerationConfiguration = {
  itemType: 'SC',
  language: 'de',
  questionCount: 1,
  difficultyPreset: 'MIXED',
  difficultyCounts: { d1: 0, d2: 0, d3: 1, d4: 0, d5: 0 },
  sourceScopes: [
    {
      resourceId: RESOURCE_ID,
      pageFrom: 2,
      pageTo: 4,
    },
  ],
  objectives: [
    {
      id: 'OBJ-01',
      text: 'Explain malolactic fermentation.',
      bloomLevel: 'understand',
    },
  ],
  bloomLevels: ['understand'],
}

function bytes(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value))
}

async function* fragments(value: Buffer): AsyncIterable<Buffer> {
  for (let offset = 0; offset < value.byteLength; offset += 11) {
    yield value.subarray(offset, offset + 11)
  }
}

function provenanceAuthority() {
  return {
    nodeIds: new Set([NODE_ID, OTHER_NODE_ID]),
    relationshipIds: new Set([RELATIONSHIP_ID]),
    chunkIds: new Set(['chunk-1', 'chunk-2']),
  }
}

function design(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    state: 'resolved',
    assessment: {
      id: BUILD_ID,
      title: 'Wine Chemistry',
      language: 'de',
      target_questions: 1,
      graph_path: '/private/worker/path',
    },
    modules: [
      {
        module_id: 'M1',
        module_name: 'All material',
        scope_type: 'module',
      },
    ],
    objectives: [
      {
        module_id: 'M1',
        objective_id: 'OBJ-01',
        objective_text: 'Explain malolactic fermentation.',
      },
    ],
    sources: [
      {
        module_id: 'M1',
        source_file: 'wine-chemistry.pdf',
        page_from: 2,
        page_to: 4,
      },
    ],
    resolved_slots: [
      {
        design_slot_id: 'slot-1',
        module_id: 'M1',
        objective_id: 'OBJ-01',
        origin_mode: 'new',
        item_format: 'single_choice',
        difficulty_scale: 3,
        bloom_level: 'understand',
        graph_resolution: { raw_model_trace: 'must not escape' },
      },
    ],
    topic_overview: {
      coverage_warnings: ['Topic coverage is concentrated.'],
      raw_diagnostics: { prompt: 'must not escape' },
    },
    generation_policy: 'new_only',
    origin_counts: { new: 1, reuse: 0, update: 0 },
    ...overrides,
  }
}

function plan(overrides: Record<string, unknown> = {}) {
  return {
    metadata: {
      stage: 'stems',
      format: 'MC5',
      graph_path: '/private/worker/path',
      model: 'private-model-name',
      question_blueprint_workflow: {
        schema_version: 1,
        question_build_id: BUILD_ID,
        generation_policy: 'new_only',
        requested_questions: 1,
        frozen_graph_sha256: 'a'.repeat(64),
        start_manifest_sha256: 'b'.repeat(64),
      },
    },
    questions: [
      {
        id: 'q01',
        module_id: 'M1',
        objective_id: 'OBJ-01',
        stem: 'Which conversion occurs during malolactic fermentation?',
        origin_mode: 'new',
        item_format: 'single_choice',
        bloom_level: 'understand',
        difficulty_scale: 3,
        source_evidence: [
          {
            evidence_id: 'E001',
            source_file: 'wine-chemistry.pdf',
            page: 3,
            excerpt: 'DISTINCTIVE RAW EXCERPT MUST NOT ESCAPE',
          },
        ],
        supporting_evidence_ids: ['E001'],
        raw_prompt: 'must not escape',
      },
    ],
    ...overrides,
  }
}

function nativeSourceSnapshot(source: {
  sourceUrl: string | null
  blobName: string | null
}) {
  return questionGenerationSourceSnapshot([
    {
      resourceId: RESOURCE_ID,
      title: 'Wine chemistry',
      contentSha256: 'd'.repeat(64),
      ...source,
    },
  ])
}

function schemaV3Plan(sourceFile: string) {
  const legacy = plan()
  return plan({
    metadata: {
      ...legacy.metadata,
      format: 'SC',
      item_format: 'sc',
      question_blueprint_workflow: {
        ...legacy.metadata.question_blueprint_workflow,
        schema_version: 3,
        frozen_graph_sha256: '7'.repeat(64),
        pinned_question_evidence: pinnedQuestionEvidence(),
      },
    },
    questions: [
      {
        ...legacy.questions[0],
        source_evidence: [
          {
            ...legacy.questions[0]!.source_evidence[0],
            source_file: sourceFile,
          },
        ],
      },
    ],
  })
}

function pinnedQuestionEvidence(overrides: Record<string, unknown> = {}) {
  const artifact = (name: string, sha256: string) => ({
    container_name: 'graph-artifacts',
    blob_name: `graph-version-1/${name}`,
    sha256,
  })

  const payload = {
    schema_version: 1,
    graph_version_id: GRAPH_VERSION_ID,
    graph_manifest: artifact('manifest.json', '1'.repeat(64)),
    graphml: artifact('graph.graphml', '7'.repeat(64)),
    vdb_chunks: artifact('vdb_chunks.json', '3'.repeat(64)),
    vdb_entities: null,
    vdb_relationships: null,
    instructor_assertions: null,
    instructor_assertion_index: null,
    resolved_domain_policy: artifact(
      'resolved_domain_policy.json',
      '4'.repeat(64)
    ),
    generation_recipe: artifact('generation_recipe.json', '5'.repeat(64)),
    correction_set: null,
    correction_application_report: null,
    bundle_sha256: '6'.repeat(64),
    graph_sha256: '7'.repeat(64),
    domain_policy_digest: '8'.repeat(64),
    generation_recipe_digest: '9'.repeat(64),
    assertion_digests: [],
    ...overrides,
  }
  const canonicalJson = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalJson)
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, canonicalJson(entry)])
      )
    }
    return value
  }
  return {
    ...payload,
    evidence_digest:
      typeof overrides.evidence_digest === 'string'
        ? overrides.evidence_digest
        : createHash('sha256')
            .update(JSON.stringify(canonicalJson(payload)))
            .digest('hex'),
  }
}

function v3Evidence() {
  return {
    graphVersionId: GRAPH_VERSION_ID,
    graphManifest: {
      containerName: 'graph-artifacts',
      blobName: 'graph-version-1/manifest.json',
      sha256: '1'.repeat(64),
    },
    graphSha256: '7'.repeat(64),
    startManifestSha256: 'b'.repeat(64),
  }
}

function finalBank(questionOverrides: Record<string, unknown> = {}) {
  return {
    metadata: {
      format: 'MC5',
      item_format: undefined as 'sc' | 'mc' | 'kprim' | undefined,
      language: 'de',
      total_questions: 1,
      source_graph: '/private/worker/path',
      model_used: 'private-model-name',
    },
    questions: [
      {
        id: 'q01',
        stem: 'Welche Umwandlung findet bei der malolaktischen Gärung statt?',
        context_inline: 'Eine Weinprobe wird nach der Gärung untersucht.',
        bloom_level: 'understand',
        content_type: 'wissens',
        question_type: 'node',
        origin_mode: 'new',
        item_format: 'single_choice',
        difficulty_scale: 3,
        difficulty_status: 'llm_reviewed',
        target_difficulty_scale: 3,
        predicted_difficulty_scale: 2.8,
        difficulty_quality_flags: ['weak_distractors'],
        options: [
          {
            label: 'A',
            text: 'Äpfelsäure wird zu Milchsäure umgewandelt.',
            is_correct: true,
            explanation: 'Das ist die zentrale Reaktion.',
          },
          {
            label: 'B',
            text: 'Milchsäure wird zu Äpfelsäure umgewandelt.',
            is_correct: false,
            explanation: 'Die Reaktionsrichtung ist umgekehrt.',
          },
        ],
        correct_label: 'A',
        citations: [
          {
            name: 'Course material evidence',
            private_description: 'must not persist',
            sources: [
              {
                file: 'wine-chemistry.pdf',
                pages: [3, 4],
                timestamps: [],
                chunk_ids: ['chunk-2', 'chunk-1'],
              },
            ],
          },
        ],
        raw_prompt: 'must not persist',
        ...questionOverrides,
      },
    ],
  }
}

function completedResult(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schema_version: 1,
    question_build_id: BUILD_ID,
    status: 'completed',
    generation_policy: 'new_only',
    requested_questions: 1,
    generated_questions: 1,
    final_questions: {
      container_name: 'question-results',
      blob_name: `question-builds/${BUILD_ID}/questions/final.json`,
      sha256: 'c'.repeat(64),
    },
    review_required_questions: 0,
    review_required_question_ids: [],
    rejected_at: null,
    reviewed_by: null,
    ...overrides,
  }
}

function completeQuestionProvenance() {
  return {
    schema_version: 1,
    lineage_status: 'complete',
    graph_version_id: 'graph-version-1',
    bundle_sha256: '1'.repeat(64),
    graph_sha256: '2'.repeat(64),
    domain_policy_digest: '3'.repeat(64),
    generation_recipe_digest: '4'.repeat(64),
    node_ids: [NODE_ID],
    relationship_ids: [],
    source_citations: [
      {
        element_type: 'node',
        element_id: NODE_ID,
        chunk_ids: ['chunk-1'],
        source_pages: ['wine-chemistry.pdf#page=3'],
        lecture_markers: [],
      },
    ],
    assertion_citations: [],
  }
}

describe('question-generation artifact normalization', () => {
  it.each([
    {
      sourceUrl: null,
      blobName: `knowledge-bases/${RESOURCE_ID}.pdf`,
    },
    {
      sourceUrl: `https://example.test/${RESOURCE_ID}.html?version=1`,
      blobName: null,
    },
  ])('uses the native graph artifact filename for source snapshots %#', (source) => {
    expect(nativeSourceSnapshot(source)[0]?.sourceFile).toBe(
      `${RESOURCE_ID}.md`
    )
  })

  it('pins graph-manifest lineage and rejects detached lineage references', () => {
    const policy = {
      filename: 'resolved_domain_policy.json',
      container_name: 'graph-artifacts',
      blob_name: 'bundle/resolved_domain_policy.json',
      sha256: '3'.repeat(64),
      size_bytes: 10,
      content_type: 'application/json',
    }
    const recipe = {
      filename: 'generation_recipe.json',
      container_name: 'graph-artifacts',
      blob_name: 'bundle/generation_recipe.json',
      sha256: '4'.repeat(64),
      size_bytes: 10,
      content_type: 'application/json',
    }
    const graph = {
      filename: 'graph_chunk_entity_relation.graphml',
      container_name: 'graph-artifacts',
      blob_name: 'bundle/graph_chunk_entity_relation.graphml',
      sha256: '2'.repeat(64),
      size_bytes: 10,
      content_type: 'application/graphml+xml',
    }
    const chunks = {
      filename: 'vdb_chunks.json',
      container_name: 'graph-artifacts',
      blob_name: 'bundle/vdb_chunks.json',
      sha256: '5'.repeat(64),
      size_bytes: 10,
      content_type: 'application/json',
    }
    const manifest = {
      schema_version: 2,
      course_id: GRAPH_VERSION_ID,
      storage_name: 'graph-storage',
      falkordb_graph_name: 'graph:name',
      bundle_sha256: '1'.repeat(64),
      graph_sha256: graph.sha256,
      domain_policy_digest: policy.sha256,
      generation_recipe_digest: recipe.sha256,
      artifacts: [graph, chunks, policy, recipe],
      policy,
      recipe,
      parent_bundle_sha256: null,
      correction_set: null,
      instructor_assertions: [],
    }
    const expected = {
      graphVersionId: GRAPH_VERSION_ID,
      storageName: 'graph-storage',
      falkordbGraphName: 'graph:name',
      bundleSha256: '1'.repeat(64),
      graphSha256: '2'.repeat(64),
    }

    expect(
      parseQuestionGenerationGraphManifest(bytes(manifest), expected)
    ).toEqual({
      graphVersionId: GRAPH_VERSION_ID,
      bundleSha256: '1'.repeat(64),
      graphSha256: '2'.repeat(64),
      domainPolicyDigest: '3'.repeat(64),
      generationRecipeDigest: '4'.repeat(64),
      graphArtifact: {
        containerName: 'graph-artifacts',
        blobName: 'bundle/graph_chunk_entity_relation.graphml',
        sha256: '2'.repeat(64),
      },
      chunksArtifact: {
        containerName: 'graph-artifacts',
        blobName: 'bundle/vdb_chunks.json',
        sha256: '5'.repeat(64),
      },
    })
    expect(() =>
      parseQuestionGenerationGraphManifest(
        bytes({
          ...manifest,
          parent_bundle_sha256: '9'.repeat(64),
          correction_set: {
            ...policy,
            filename: 'correction_set.json',
            blob_name: 'bundle/correction_set.json',
          },
        }),
        expected
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
    expect(() =>
      parseQuestionGenerationGraphManifest(
        bytes({
          ...manifest,
          artifacts: [graph, policy, recipe],
        }),
        expected
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
    expect(() =>
      parseQuestionGenerationGraphManifest(
        bytes({
          ...manifest,
          policy: {
            ...policy,
            blob_name: 'detached/resolved_domain_policy.json',
          },
        }),
        expected
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('does not accept a chunk ID that appears only inside source text', async () => {
    const graph = Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="node-id" for="node" attr.name="kg_node_id" attr.type="string"/>
  <graph edgedefault="undirected">
    <node id="physical-a"><data key="node-id">${NODE_ID}</data></node>
  </graph>
</graphml>`)
    const chunks = bytes({
      data: [
        {
          __id__: 'chunk-1',
          content: '{"__id__":"invented-chunk"}',
        },
      ],
      matrix: '',
    })

    await expect(
      verifyQuestionGenerationProvenanceAuthority(
        fragments(graph),
        fragments(chunks),
        {
          nodeIds: new Set([NODE_ID]),
          relationshipIds: new Set(),
          chunkIds: new Set(['invented-chunk']),
        }
      )
    ).rejects.toMatchObject({ code: 'ARTIFACT_INVALID' })
  })

  it('verifies streamed identities at canonical GraphML and chunk-store paths', async () => {
    const graph = Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="node-id" for="node" attr.name="kg_node_id" attr.type="string"/>
  <key id="relationship-id" for="edge" attr.name="kg_relationship_id" attr.type="string"/>
  <graph edgedefault="undirected">
    <node id="physical-a"><data key="node-id">${NODE_ID}</data></node>
    <edge source="physical-a" target="physical-a"><data key="relationship-id">${RELATIONSHIP_ID}</data></edge>
  </graph>
</graphml>`)
    const chunks = bytes({
      data: [{ __id__: 'chunk-1', content: 'Evidence' }],
      embedding_dim: 1,
      matrix: 'AAAAAA==',
    })

    await expect(
      verifyQuestionGenerationProvenanceAuthority(
        fragments(graph),
        fragments(chunks),
        {
          nodeIds: new Set([NODE_ID]),
          relationshipIds: new Set([RELATIONSHIP_ID]),
          chunkIds: new Set(['chunk-1']),
        }
      )
    ).resolves.toEqual({
      nodeIds: new Set([NODE_ID]),
      relationshipIds: new Set([RELATIONSHIP_ID]),
      chunkIds: new Set(['chunk-1']),
    })
  })

  it('rejects GraphML-shaped decoys outside the canonical namespace root', async () => {
    const graph = Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<wrapper xmlns:g="http://graphml.graphdrawing.org/xmlns">
  <g:graphml>
    <g:key id="node-id" for="node" attr.name="kg_node_id"/>
    <g:graph><g:node><g:data key="node-id">${NODE_ID}</g:data></g:node></g:graph>
  </g:graphml>
</wrapper>`)

    await expect(
      verifyQuestionGenerationProvenanceAuthority(
        fragments(graph),
        fragments(bytes({ data: [{ __id__: 'chunk-1' }] })),
        {
          nodeIds: new Set([NODE_ID]),
          relationshipIds: new Set(),
          chunkIds: new Set(),
        }
      )
    ).rejects.toMatchObject({ code: 'ARTIFACT_INVALID' })
  })

  it('rejects identities inside a nested canonical GraphML element', async () => {
    const graph = Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graphml>
    <key id="node-id" for="node" attr.name="kg_node_id"/>
    <graph><node><data key="node-id">${NODE_ID}</data></node></graph>
  </graphml>
</graphml>`)

    await expect(
      verifyQuestionGenerationProvenanceAuthority(
        fragments(graph),
        fragments(bytes({ data: [{ __id__: 'chunk-1' }] })),
        {
          nodeIds: new Set([NODE_ID]),
          relationshipIds: new Set(),
          chunkIds: new Set(),
        }
      )
    ).rejects.toMatchObject({ code: 'ARTIFACT_INVALID' })
  })

  it('rejects chunk identity decoys outside root data records', async () => {
    const graph = Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graph edgedefault="undirected"/>
</graphml>`)
    const chunks = bytes({
      decoy: { __id__: 'invented-chunk' },
      data: [{ __id__: 'chunk-1' }],
    })

    await expect(
      verifyQuestionGenerationProvenanceAuthority(
        fragments(graph),
        fragments(chunks),
        {
          nodeIds: new Set(),
          relationshipIds: new Set(),
          chunkIds: new Set(['invented-chunk']),
        }
      )
    ).rejects.toMatchObject({ code: 'ARTIFACT_INVALID' })
  })

  it('rejects a truncated chunk store even after encountering a claimed ID', async () => {
    const graph = Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graph edgedefault="undirected"/>
</graphml>`)
    const chunks = Buffer.from('{"data":[{"__id__":"chunk-1"}]')

    await expect(
      verifyQuestionGenerationProvenanceAuthority(
        fragments(graph),
        fragments(chunks),
        {
          nodeIds: new Set(),
          relationshipIds: new Set(),
          chunkIds: new Set(['chunk-1']),
        }
      )
    ).rejects.toMatchObject({ code: 'ARTIFACT_INVALID' })
  })

  it('does not accumulate large irrelevant chunk-store keys', async () => {
    const graph = Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graph edgedefault="undirected"/>
</graphml>`)
    const chunks = bytes({
      ['irrelevant-'.repeat(1_000)]: 'ignored',
      data: [{ __id__: 'chunk-1' }],
    })

    await expect(
      verifyQuestionGenerationProvenanceAuthority(
        fragments(graph),
        fragments(chunks),
        {
          nodeIds: new Set(),
          relationshipIds: new Set(),
          chunkIds: new Set(['chunk-1']),
        }
      )
    ).resolves.toMatchObject({ chunkIds: new Set(['chunk-1']) })
  })

  it('returns a bounded Design summary without worker diagnostics', () => {
    const summary = parseQuestionGenerationDesign(bytes(design()), {
      buildId: BUILD_ID,
      configuration,
      sourceSnapshot,
    })

    expect(summary).toEqual({
      title: 'Wine Chemistry',
      questionCount: 1,
      objectives: configuration.objectives,
      modules: [
        { moduleId: 'M1', moduleName: 'All material', questionCount: 1 },
      ],
      sources: [{ sourceFile: 'wine-chemistry.pdf', pageFrom: 2, pageTo: 4 }],
      slots: [
        {
          sourceQuestionId: 'slot-1',
          moduleId: 'M1',
          objectiveId: 'OBJ-01',
          bloomLevel: 'understand',
          targetDifficulty: 3,
        },
      ],
      warnings: [
        {
          code: 'PIPELINE_COVERAGE_WARNING',
          message: 'Topic coverage is concentrated.',
        },
      ],
    })
    expect(JSON.stringify(summary)).not.toContain('raw_model_trace')
    expect(JSON.stringify(summary)).not.toContain('private/worker')
  })

  it('keeps worker-classified Bloom intent unresolved during Design review', () => {
    const artifact = design()
    artifact.resolved_slots[0]!.bloom_level = ''

    const summary = parseQuestionGenerationDesign(bytes(artifact), {
      buildId: BUILD_ID,
      configuration: {
        ...configuration,
        objectives: [
          {
            ...configuration.objectives[0]!,
            bloomLevel: null,
          },
        ],
      },
      sourceSnapshot,
    })

    expect(summary.slots).toEqual([
      {
        sourceQuestionId: 'slot-1',
        moduleId: 'M1',
        objectiveId: 'OBJ-01',
        bloomLevel: null,
        targetDifficulty: 3,
      },
    ])
  })

  it('rejects unresolved Design Bloom when the objective fixes its level', () => {
    const artifact = design()
    artifact.resolved_slots[0]!.bloom_level = ''

    expect(() =>
      parseQuestionGenerationDesign(bytes(artifact), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('represents an unrestricted whole-graph Design without source rows', () => {
    const summary = parseQuestionGenerationDesign(
      bytes(design({ sources: [] })),
      {
        buildId: BUILD_ID,
        configuration: {
          ...configuration,
          sourceScopes: [
            {
              resourceId: RESOURCE_ID,
              pageFrom: null,
              pageTo: null,
            },
          ],
        },
        sourceSnapshot,
      }
    )

    expect(summary.sources).toEqual([])
  })

  it('returns a bounded Plan summary without model or prompt data', () => {
    const summary = parseQuestionGenerationPlan(bytes(plan()), {
      buildId: BUILD_ID,
      configuration,
      sourceSnapshot,
    })

    expect(summary).toEqual({
      questionCount: 1,
      questions: [
        {
          sourceQuestionId: 'q01',
          moduleId: 'M1',
          objectiveId: 'OBJ-01',
          stem: 'Which conversion occurs during malolactic fermentation?',
          bloomLevel: 'understand',
          targetDifficulty: 3,
          sources: [
            {
              sourceFile: 'wine-chemistry.pdf',
              pageFrom: 3,
              pageTo: 3,
            },
          ],
        },
      ],
      warnings: [],
    })
    expect(JSON.stringify(summary)).not.toContain('private-model-name')
    expect(JSON.stringify(summary)).not.toContain('raw_prompt')
    expect(JSON.stringify(summary)).not.toContain('DISTINCTIVE RAW EXCERPT')
  })

  it('accepts worker-classified Bloom for an objective without a fixed level', () => {
    const artifact = plan()
    artifact.questions[0]!.bloom_level = 'apply'

    const summary = parseQuestionGenerationPlan(bytes(artifact), {
      buildId: BUILD_ID,
      configuration: {
        ...configuration,
        objectives: [
          {
            ...configuration.objectives[0]!,
            bloomLevel: null,
          },
        ],
      },
      sourceSnapshot,
    })

    expect(summary.questions[0]?.bloomLevel).toBe('apply')
  })

  it('rejects worker Bloom that changes a fixed objective level', () => {
    const artifact = plan()
    artifact.questions[0]!.bloom_level = 'apply'

    expect(() =>
      parseQuestionGenerationPlan(bytes(artifact), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('accepts the direct schema-v3 SC Plan contract', () => {
    const legacyMetadata = plan().metadata
    const summary = parseQuestionGenerationPlan(
      bytes(
        plan({
          metadata: {
            ...legacyMetadata,
            format: 'SC',
            item_format: 'sc',
            question_blueprint_workflow: {
              ...legacyMetadata.question_blueprint_workflow,
              schema_version: 3,
              frozen_graph_sha256: '7'.repeat(64),
              pinned_question_evidence: pinnedQuestionEvidence(),
            },
          },
        })
      ),
      {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
        v3Evidence: v3Evidence(),
      }
    )

    expect(summary).toMatchObject({
      questionCount: 1,
      questions: [
        {
          sourceQuestionId: 'q01',
          moduleId: 'M1',
          objectiveId: 'OBJ-01',
          bloomLevel: 'understand',
          targetDifficulty: 3,
        },
      ],
    })
    expect(JSON.stringify(summary)).not.toContain('pinned_question_evidence')
  })

  it('accepts schema-v3 Plan evidence for the native graph artifact', () => {
    expect(
      parseQuestionGenerationPlan(bytes(schemaV3Plan(`${RESOURCE_ID}.md`)), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot: nativeSourceSnapshot({
          sourceUrl: null,
          blobName: `knowledge-bases/${RESOURCE_ID}.pdf`,
        }),
        v3Evidence: v3Evidence(),
      }).questionCount
    ).toBe(1)
  })

  it('rejects the original extension for native graph evidence', () => {
    expect(() =>
      parseQuestionGenerationPlan(bytes(schemaV3Plan(`${RESOURCE_ID}.pdf`)), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot: nativeSourceSnapshot({
          sourceUrl: null,
          blobName: `knowledge-bases/${RESOURCE_ID}.pdf`,
        }),
        v3Evidence: v3Evidence(),
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('accepts the direct schema-v3 KPRIM Plan contract', () => {
    const legacy = plan()
    const summary = parseQuestionGenerationPlan(
      bytes(
        plan({
          metadata: {
            ...legacy.metadata,
            format: 'KPRIM',
            item_format: 'kprim',
            question_blueprint_workflow: {
              ...legacy.metadata.question_blueprint_workflow,
              schema_version: 3,
              frozen_graph_sha256: '7'.repeat(64),
              pinned_question_evidence: pinnedQuestionEvidence(),
            },
          },
          questions: [
            {
              ...legacy.questions[0],
              item_format: 'kprim',
            },
          ],
        })
      ),
      {
        buildId: BUILD_ID,
        configuration: { ...configuration, itemType: 'KPRIM' },
        sourceSnapshot,
        v3Evidence: v3Evidence(),
      }
    )

    expect(summary.questionCount).toBe(1)
  })

  it('accepts the direct schema-v3 MC Plan contract', () => {
    const legacy = plan()
    const summary = parseQuestionGenerationPlan(
      bytes(
        plan({
          metadata: {
            ...legacy.metadata,
            format: 'MC',
            item_format: 'mc',
            question_blueprint_workflow: {
              ...legacy.metadata.question_blueprint_workflow,
              schema_version: 3,
              frozen_graph_sha256: '7'.repeat(64),
              pinned_question_evidence: pinnedQuestionEvidence(),
            },
          },
          questions: [
            {
              ...legacy.questions[0],
              item_format: 'multiple_choice',
            },
          ],
        })
      ),
      {
        buildId: BUILD_ID,
        configuration: { ...configuration, itemType: 'MC' },
        sourceSnapshot,
        v3Evidence: v3Evidence(),
      }
    )

    expect(summary.questionCount).toBe(1)
  })

  it('rejects cross-version Plan formats and unbound current evidence', () => {
    const legacy = plan()
    const current = plan({
      metadata: {
        ...legacy.metadata,
        format: 'SC',
        item_format: 'sc',
        question_blueprint_workflow: {
          ...legacy.metadata.question_blueprint_workflow,
          schema_version: 3,
          frozen_graph_sha256: '7'.repeat(64),
          pinned_question_evidence: pinnedQuestionEvidence(),
        },
      },
    })

    expect(() =>
      parseQuestionGenerationPlan(
        bytes(
          plan({
            metadata: { ...legacy.metadata, format: 'SC' },
          })
        ),
        { buildId: BUILD_ID, configuration, sourceSnapshot }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
    expect(() =>
      parseQuestionGenerationPlan(bytes(legacy), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
        v3Evidence: v3Evidence(),
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
    expect(() =>
      parseQuestionGenerationPlan(bytes(current), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
    expect(() =>
      parseQuestionGenerationPlan(
        bytes({
          ...current,
          metadata: { ...current.metadata, format: 'MC5' },
        }),
        {
          buildId: BUILD_ID,
          configuration,
          sourceSnapshot,
          v3Evidence: v3Evidence(),
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it.each([
    {
      schema_version: 2,
    },
    {
      schema_version: 3,
      pinned_question_evidence: pinnedQuestionEvidence({
        evidence_digest: 'not-a-digest',
      }),
    },
    {
      schema_version: 3,
      pinned_question_evidence: pinnedQuestionEvidence({
        undeclared_private_field: 'must be rejected',
      }),
    },
    {
      schema_version: 3,
      pinned_question_evidence: pinnedQuestionEvidence({
        graph_version_id: 'graph-version-2',
      }),
    },
  ])('rejects unsupported schema-v3 Plan provenance %#', (workflow) => {
    const legacy = plan()
    expect(() =>
      parseQuestionGenerationPlan(
        bytes(
          plan({
            metadata: {
              ...legacy.metadata,
              format: 'SC',
              item_format: 'sc',
              question_blueprint_workflow: {
                ...legacy.metadata.question_blueprint_workflow,
                ...workflow,
              },
            },
          })
        ),
        {
          buildId: BUILD_ID,
          configuration,
          sourceSnapshot,
          v3Evidence: v3Evidence(),
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('validates a completed result and normalizes its final reference', () => {
    expect(
      parseQuestionGenerationResult(bytes(completedResult()), {
        buildId: BUILD_ID,
        questionCount: 1,
      })
    ).toEqual({
      schemaVersion: 1,
      status: 'completed',
      requestedQuestions: 1,
      generatedQuestions: 1,
      finalQuestions: {
        containerName: 'question-results',
        blobName: `question-builds/${BUILD_ID}/questions/final.json`,
        sha256: 'c'.repeat(64),
      },
      questionProvenanceIndex: null,
      reviewRequiredQuestions: 0,
      reviewRequiredQuestionIds: [],
      legacyCompleted: false,
      rejectedAt: null,
      reviewedBy: null,
    })
  })

  it('requires and verifies complete schema-v2 provenance', () => {
    const indexArtifact = {
      container_name: 'question-results',
      blob_name: `question-builds/${BUILD_ID}/questions/question_provenance_index.json`,
      sha256: '5'.repeat(64),
    }
    const result = parseQuestionGenerationResult(
      bytes(
        completedResult({
          schema_version: 2,
          question_provenance_index: indexArtifact,
        })
      ),
      {
        buildId: BUILD_ID,
        questionCount: 1,
        requiresCompleteProvenance: true,
      }
    )
    const lineage = {
      graphVersionId: 'graph-version-1',
      bundleSha256: '1'.repeat(64),
      graphSha256: '2'.repeat(64),
      domainPolicyDigest: '3'.repeat(64),
      generationRecipeDigest: '4'.repeat(64),
    }
    const currentBank = finalBank({
      provenance: completeQuestionProvenance(),
    })
    currentBank.metadata.format = 'SC'
    currentBank.metadata.item_format = 'sc'
    const questions = parseQuestionGenerationFinalBank(bytes(currentBank), {
      questionCount: 1,
      sourceSnapshot,
      expectedQuestionIds: ['q01'],
      result,
      lineage,
      provenanceAuthority: provenanceAuthority(),
    })

    expect(questions[0]?.provenance).toMatchObject({
      lineageStatus: 'complete',
      graphVersionId: 'graph-version-1',
      nodeIds: [NODE_ID],
    })
    expect(() =>
      parseQuestionGenerationFinalBank(
        bytes(finalBank({ provenance: completeQuestionProvenance() })),
        {
          questionCount: 1,
          sourceSnapshot,
          expectedQuestionIds: ['q01'],
          result,
          lineage,
          provenanceAuthority: provenanceAuthority(),
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
    expect(
      parseQuestionGenerationProvenanceIndex(
        bytes({
          schema_version: 1,
          question_ids: ['q01'],
          by_node_id: { [NODE_ID]: ['q01'] },
          by_relationship_id: {},
          by_assertion_id: {},
          by_source_ref: {
            'chunk:chunk-1': ['q01'],
            'page:wine-chemistry.pdf#page=3': ['q01'],
          },
        }),
        questions
      )
    ).toMatchObject({
      questionIds: ['q01'],
      byNodeId: { [NODE_ID]: ['q01'] },
    })

    expect(() =>
      parseQuestionGenerationFinalBank(
        bytes(
          finalBank({
            provenance: {
              ...completeQuestionProvenance(),
              bundle_sha256: '9'.repeat(64),
            },
          })
        ),
        {
          questionCount: 1,
          sourceSnapshot,
          expectedQuestionIds: ['q01'],
          result,
          lineage,
          provenanceAuthority: provenanceAuthority(),
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
    expect(() =>
      parseQuestionGenerationFinalBank(
        bytes(
          finalBank({
            provenance: {
              ...completeQuestionProvenance(),
              assertion_citations: [
                { assertion_id: 'assertion-1', version: 1 },
              ],
            },
          })
        ),
        {
          questionCount: 1,
          sourceSnapshot,
          expectedQuestionIds: ['q01'],
          result,
          lineage,
          provenanceAuthority: provenanceAuthority(),
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))

    expect(() =>
      parseQuestionGenerationFinalBank(
        bytes(
          finalBank({
            provenance: {
              ...completeQuestionProvenance(),
              node_ids: [`node_${'f'.repeat(32)}`],
              source_citations: [
                {
                  ...completeQuestionProvenance().source_citations[0],
                  element_id: `node_${'f'.repeat(32)}`,
                },
              ],
            },
          })
        ),
        {
          questionCount: 1,
          sourceSnapshot,
          expectedQuestionIds: ['q01'],
          result,
          lineage,
          provenanceAuthority: provenanceAuthority(),
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
    expect(() =>
      parseQuestionGenerationFinalBank(
        bytes(
          finalBank({
            citations: [
              {
                sources: [
                  {
                    file: 'wine-chemistry.pdf',
                    pages: [3],
                    chunk_ids: ['invented-chunk'],
                  },
                ],
              },
            ],
            provenance: {
              ...completeQuestionProvenance(),
              source_citations: [
                {
                  ...completeQuestionProvenance().source_citations[0],
                  chunk_ids: ['invented-chunk'],
                },
              ],
            },
          })
        ),
        {
          questionCount: 1,
          sourceSnapshot,
          expectedQuestionIds: ['q01'],
          result,
          lineage,
          provenanceAuthority: provenanceAuthority(),
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
    expect(() =>
      parseQuestionGenerationFinalBank(
        bytes(
          finalBank({
            citations: [
              {
                sources: [
                  {
                    file: 'wine-chemistry.pdf',
                    pages: [3],
                    chunk_ids: ['chunk-1', 'invented-chunk'],
                  },
                ],
              },
            ],
            provenance: completeQuestionProvenance(),
          })
        ),
        {
          questionCount: 1,
          sourceSnapshot,
          expectedQuestionIds: ['q01'],
          result,
          lineage,
          provenanceAuthority: provenanceAuthority(),
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('accepts graph provenance backed by pinned chunks beyond direct citations', () => {
    const provenance = completeQuestionProvenance()
    provenance.source_citations[0]!.chunk_ids = ['chunk-1', 'chunk-2']
    const currentBank = finalBank({
      citations: [
        {
          sources: [
            {
              file: 'wine-chemistry.pdf',
              pages: [3],
              chunk_ids: ['chunk-1'],
            },
          ],
        },
      ],
      provenance,
    })
    currentBank.metadata.format = 'SC'
    currentBank.metadata.item_format = 'sc'

    const questions = parseQuestionGenerationFinalBank(bytes(currentBank), {
      questionCount: 1,
      sourceSnapshot,
      expectedQuestionIds: ['q01'],
      result: parseQuestionGenerationResult(
        bytes(
          completedResult({
            schema_version: 2,
            question_provenance_index: {
              container_name: 'question-results',
              blob_name: `question-builds/${BUILD_ID}/questions/question_provenance_index.json`,
              sha256: '5'.repeat(64),
            },
          })
        ),
        {
          buildId: BUILD_ID,
          questionCount: 1,
          requiresCompleteProvenance: true,
        }
      ),
      lineage: {
        graphVersionId: 'graph-version-1',
        bundleSha256: '1'.repeat(64),
        graphSha256: '2'.repeat(64),
        domainPolicyDigest: '3'.repeat(64),
        generationRecipeDigest: '4'.repeat(64),
      },
      provenanceAuthority: provenanceAuthority(),
    })

    expect(questions[0]?.citations[0]?.chunkIds).toEqual(['chunk-1'])
    expect(questions[0]?.provenance?.sourceCitations[0]?.chunkIds).toEqual([
      'chunk-1',
      'chunk-2',
    ])
  })

  it('accepts a current completed-with-review result manifest', () => {
    expect(
      parseQuestionGenerationResult(
        bytes(
          completedResult({
            status: 'completed_with_review',
            review_required_questions: 1,
            review_required_question_ids: ['q01'],
          })
        ),
        { buildId: BUILD_ID, questionCount: 1 }
      )
    ).toMatchObject({
      status: 'completed_with_review',
      reviewRequiredQuestions: 1,
      reviewRequiredQuestionIds: ['q01'],
      legacyCompleted: false,
    })
  })

  it('accepts only the fully absent legacy completed metadata shape', () => {
    const legacy = completedResult()
    delete legacy.requested_questions
    delete legacy.review_required_questions
    delete legacy.review_required_question_ids

    expect(
      parseQuestionGenerationResult(bytes(legacy), {
        buildId: BUILD_ID,
        questionCount: 1,
      })
    ).toMatchObject({
      status: 'completed',
      requestedQuestions: null,
      reviewRequiredQuestions: 0,
      reviewRequiredQuestionIds: [],
      legacyCompleted: true,
    })

    expect(() =>
      parseQuestionGenerationResult(
        bytes({
          ...legacy,
          review_required_question_ids: [],
        }),
        { buildId: BUILD_ID, questionCount: 1 }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it.each([
    design({ schema_version: 2 }),
    design({ assessment: { ...design().assessment, id: crypto.randomUUID() } }),
    design({ origin_counts: { new: 0, reuse: 1, update: 0 } }),
    design({
      resolved_slots: [
        { ...design().resolved_slots[0], item_format: undefined },
      ],
    }),
  ])('rejects an invalid Design artifact %#', (artifact) => {
    expect(() =>
      parseQuestionGenerationDesign(bytes(artifact), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it.each([
    plan({
      metadata: {
        ...plan().metadata,
        question_blueprint_workflow: {
          ...plan().metadata.question_blueprint_workflow,
          question_build_id: crypto.randomUUID(),
        },
      },
    }),
    plan({ questions: [{ ...plan().questions[0], origin_mode: 'reuse' }] }),
    plan({ questions: [{ ...plan().questions[0], bloom_level: 'create' }] }),
    plan({
      questions: [{ ...plan().questions[0], item_format: undefined }],
    }),
  ])('rejects an invalid Plan artifact %#', (artifact) => {
    expect(() =>
      parseQuestionGenerationPlan(bytes(artifact), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('rejects Design evidence that does not match a registered source', () => {
    const artifact = design({
      sources: [
        {
          ...design().sources[0],
          source_file: 'unknown.pdf',
        },
      ],
    })

    expect(() =>
      parseQuestionGenerationDesign(bytes(artifact), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('rejects Plan evidence outside the registered page range', () => {
    const artifact = plan({
      questions: [
        {
          ...plan().questions[0],
          source_evidence: [
            {
              ...plan().questions[0]!.source_evidence[0],
              page: 13,
            },
          ],
        },
      ],
    })

    expect(() =>
      parseQuestionGenerationPlan(bytes(artifact), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('rejects Plan provenance for an unknown objective', () => {
    const artifact = plan({
      questions: [
        {
          ...plan().questions[0],
          objective_id: 'OBJ-UNKNOWN',
        },
      ],
    })

    expect(() =>
      parseQuestionGenerationPlan(bytes(artifact), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('rejects duplicate Design slot IDs even when counts match', () => {
    const twoQuestionConfiguration: QuestionGenerationConfiguration = {
      ...configuration,
      questionCount: 2,
      difficultyCounts: { d1: 0, d2: 0, d3: 2, d4: 0, d5: 0 },
    }
    const slot = design().resolved_slots[0]!
    const artifact = design({
      assessment: { ...design().assessment, target_questions: 2 },
      resolved_slots: [slot, { ...slot }],
      origin_counts: { new: 2, reuse: 0, update: 0 },
    })

    expect(() =>
      parseQuestionGenerationDesign(bytes(artifact), {
        buildId: BUILD_ID,
        configuration: twoQuestionConfiguration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('rejects duplicate Plan question IDs even when counts match', () => {
    const twoQuestionConfiguration: QuestionGenerationConfiguration = {
      ...configuration,
      questionCount: 2,
      difficultyCounts: { d1: 0, d2: 0, d3: 2, d4: 0, d5: 0 },
    }
    const question = plan().questions[0]!
    const artifact = plan({
      metadata: {
        ...plan().metadata,
        question_blueprint_workflow: {
          ...plan().metadata.question_blueprint_workflow,
          requested_questions: 2,
        },
      },
      questions: [question, { ...question }],
    })

    expect(() =>
      parseQuestionGenerationPlan(bytes(artifact), {
        buildId: BUILD_ID,
        configuration: twoQuestionConfiguration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('rejects more than twenty Design slots', () => {
    const slot = design().resolved_slots[0]!
    const artifact = design({
      assessment: { ...design().assessment, target_questions: 20 },
      resolved_slots: Array.from({ length: 21 }, (_, index) => ({
        ...slot,
        design_slot_id: `slot-${index + 1}`,
      })),
      origin_counts: { new: 20, reuse: 0, update: 0 },
    })

    expect(() =>
      parseQuestionGenerationDesign(bytes(artifact), {
        buildId: BUILD_ID,
        configuration: {
          ...configuration,
          questionCount: 20,
          difficultyCounts: { d1: 0, d2: 0, d3: 20, d4: 0, d5: 0 },
        },
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('rejects more than eight supporting citations per Plan question', () => {
    const evidence = Array.from({ length: 9 }, (_, index) => ({
      evidence_id: `E${index + 1}`,
      source_file: 'wine-chemistry.pdf',
      page: index + 1,
    }))
    const artifact = plan({
      questions: [
        {
          ...plan().questions[0],
          source_evidence: evidence,
          supporting_evidence_ids: evidence.map((item) => item.evidence_id),
        },
      ],
    })

    expect(() =>
      parseQuestionGenerationPlan(bytes(artifact), {
        buildId: BUILD_ID,
        configuration,
        sourceSnapshot,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('rejects a mismatched completed result count', () => {
    expect(() =>
      parseQuestionGenerationResult(
        bytes(completedResult({ generated_questions: 0 })),
        { buildId: BUILD_ID, questionCount: 1 }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('rejects non-canonical immutable artifact coordinates', () => {
    expect(() =>
      parseQuestionGenerationResult(
        bytes(
          completedResult({
            final_questions: {
              container_name: 'question--results',
              blob_name: `question-builds/${BUILD_ID}/questions/final.json`,
              sha256: 'c'.repeat(64),
            },
          })
        ),
        { buildId: BUILD_ID, questionCount: 1 }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('normalizes a reviewed final SC bank without private diagnostics', () => {
    const result = parseQuestionGenerationResult(
      bytes(
        completedResult({
          status: 'completed_with_review',
          review_required_questions: 1,
          review_required_question_ids: ['q01'],
        })
      ),
      { buildId: BUILD_ID, questionCount: 1 }
    )
    const questions = parseQuestionGenerationFinalBank(
      bytes(finalBank({ difficulty_status: 'review_required' })),
      {
        questionCount: 1,
        sourceSnapshot,
        expectedQuestionIds: ['q01'],
        result,
      }
    )

    expect(questions).toEqual([
      {
        itemType: 'SC',
        sourceQuestionId: 'q01',
        name: 'Welche Umwandlung findet bei der malolaktischen Gärung statt?',
        stem: 'Welche Umwandlung findet bei der malolaktischen Gärung statt?',
        context: 'Eine Weinprobe wird nach der Gärung untersucht.',
        explanation: null,
        choices: [
          {
            id: 'A',
            label: 'A',
            text: 'Äpfelsäure wird zu Milchsäure umgewandelt.',
            correct: true,
            feedback: 'Das ist die zentrale Reaktion.',
          },
          {
            id: 'B',
            label: 'B',
            text: 'Milchsäure wird zu Äpfelsäure umgewandelt.',
            correct: false,
            feedback: 'Die Reaktionsrichtung ist umgekehrt.',
          },
        ],
        bloomLevel: 'understand',
        targetDifficulty: 3,
        predictedDifficulty: 2.8,
        qualityFlags: ['difficulty_review_required', 'weak_distractors'],
        citations: [
          {
            resourceId: RESOURCE_ID,
            sourceFile: 'wine-chemistry.pdf',
            pageFrom: 3,
            pageTo: 4,
            chunkIds: ['chunk-1', 'chunk-2'],
          },
        ],
        provenance: null,
      },
    ])
    expect(JSON.stringify(questions)).not.toContain('private')
    expect(JSON.stringify(questions)).not.toContain('raw_prompt')
  })

  it('normalizes an exact four-statement KPRIM bank as a discriminated draft', () => {
    const result = parseQuestionGenerationResult(bytes(completedResult()), {
      buildId: BUILD_ID,
      questionCount: 1,
    })
    const artifact = finalBank()
    artifact.metadata.format = 'KPRIM'
    artifact.questions[0] = {
      ...artifact.questions[0],
      item_format: 'kprim',
      options: undefined,
      correct_label: undefined,
      statements: [
        {
          text: 'Liquid assets can cover short-term obligations.',
          is_correct: true,
          explanation: 'This is liquidity.',
        },
        {
          text: 'Profitability guarantees liquidity.',
          is_correct: false,
          explanation: 'The concepts differ.',
        },
        {
          text: 'Payment timing affects liquidity needs.',
          is_correct: true,
          explanation: 'Maturities matter.',
        },
        {
          text: 'Liquidity is independent of cash flow.',
          is_correct: false,
          explanation: 'Cash flow is central.',
        },
      ],
    } as unknown as (typeof artifact.questions)[number]

    const questions = parseQuestionGenerationFinalBank(bytes(artifact), {
      itemType: 'KPRIM',
      questionCount: 1,
      sourceSnapshot,
      expectedQuestionIds: ['q01'],
      result,
    })

    expect(questions[0]).toMatchObject({
      itemType: 'KPRIM',
      choices: [
        { id: 'A', label: 'A', correct: true },
        { id: 'B', label: 'B', correct: false },
        { id: 'C', label: 'C', correct: true },
        { id: 'D', label: 'D', correct: false },
      ],
    })
  })

  it('consumes the worker KPRIM golden contract unchanged', () => {
    const result = parseQuestionGenerationResult(bytes(completedResult()), {
      buildId: BUILD_ID,
      questionCount: 1,
    })

    expect(
      parseQuestionGenerationFinalBank(KPRIM_GOLDEN_BANK, {
        itemType: 'KPRIM',
        questionCount: 1,
        sourceSnapshot,
        expectedQuestionIds: ['q-M1-002'],
        result,
      })
    ).toEqual([
      expect.objectContaining({
        itemType: 'KPRIM',
        sourceQuestionId: 'q-M1-002',
        choices: [
          expect.objectContaining({ id: 'A', correct: true }),
          expect.objectContaining({ id: 'B', correct: false }),
          expect.objectContaining({ id: 'C', correct: true }),
          expect.objectContaining({ id: 'D', correct: false }),
        ],
      }),
    ])
  })

  it('consumes the worker MC golden contract unchanged', () => {
    const result = parseQuestionGenerationResult(bytes(completedResult()), {
      buildId: BUILD_ID,
      questionCount: 1,
    })

    expect(
      parseQuestionGenerationFinalBank(MC_GOLDEN_BANK, {
        itemType: 'MC',
        questionCount: 1,
        sourceSnapshot,
        expectedQuestionIds: ['q-M1-002'],
        result,
      })
    ).toEqual([
      expect.objectContaining({
        itemType: 'MC',
        sourceQuestionId: 'q-M1-002',
        choices: [
          expect.objectContaining({ id: 'A', correct: true }),
          expect.objectContaining({ id: 'B', correct: false }),
          expect.objectContaining({ id: 'C', correct: true }),
          expect.objectContaining({ id: 'D', correct: false }),
          expect.objectContaining({ id: 'E', correct: false }),
        ],
      }),
    ])
  })

  it.each([
    undefined,
    'sc',
    'kprim',
  ])('rejects a current MC bank with metadata.item_format=%s', (itemFormat) => {
    const artifact = JSON.parse(MC_GOLDEN_BANK.toString('utf8'))
    if (itemFormat === undefined) {
      delete artifact.metadata.item_format
    } else {
      artifact.metadata.item_format = itemFormat
    }
    artifact.questions[0].provenance = completeQuestionProvenance()
    const result = parseQuestionGenerationResult(
      bytes(
        completedResult({
          schema_version: 2,
          question_provenance_index: {
            container_name: 'question-results',
            blob_name: `question-builds/${BUILD_ID}/questions/question_provenance_index.json`,
            sha256: '5'.repeat(64),
          },
        })
      ),
      {
        buildId: BUILD_ID,
        questionCount: 1,
        requiresCompleteProvenance: true,
      }
    )

    expect(() =>
      parseQuestionGenerationFinalBank(bytes(artifact), {
        itemType: 'MC',
        questionCount: 1,
        sourceSnapshot,
        expectedQuestionIds: ['q-M1-002'],
        result,
        lineage: {
          graphVersionId: 'graph-version-1',
          bundleSha256: '1'.repeat(64),
          graphSha256: '2'.repeat(64),
          domainPolicyDigest: '3'.repeat(64),
          generationRecipeDigest: '4'.repeat(64),
        },
        provenanceAuthority: provenanceAuthority(),
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('accepts a current MC bank with canonical metadata.item_format', () => {
    const artifact = JSON.parse(MC_GOLDEN_BANK.toString('utf8'))
    artifact.questions[0].provenance = completeQuestionProvenance()
    const result = parseQuestionGenerationResult(
      bytes(
        completedResult({
          schema_version: 2,
          question_provenance_index: {
            container_name: 'question-results',
            blob_name: `question-builds/${BUILD_ID}/questions/question_provenance_index.json`,
            sha256: '5'.repeat(64),
          },
        })
      ),
      {
        buildId: BUILD_ID,
        questionCount: 1,
        requiresCompleteProvenance: true,
      }
    )

    expect(
      parseQuestionGenerationFinalBank(bytes(artifact), {
        itemType: 'MC',
        questionCount: 1,
        sourceSnapshot,
        expectedQuestionIds: ['q-M1-002'],
        result,
        lineage: {
          graphVersionId: 'graph-version-1',
          bundleSha256: '1'.repeat(64),
          graphSha256: '2'.repeat(64),
          domainPolicyDigest: '3'.repeat(64),
          generationRecipeDigest: '4'.repeat(64),
        },
        provenanceAuthority: provenanceAuthority(),
      })
    ).toEqual([
      expect.objectContaining({
        itemType: 'MC',
        sourceQuestionId: 'q-M1-002',
      }),
    ])
  })

  it('rejects an SC-shaped MC bank', () => {
    const result = parseQuestionGenerationResult(bytes(completedResult()), {
      buildId: BUILD_ID,
      questionCount: 1,
    })
    const artifact = JSON.parse(MC_GOLDEN_BANK.toString('utf8'))
    artifact.questions[0].options = artifact.questions[0].options.map(
      (option: { is_correct: boolean }, index: number) => ({
        ...option,
        is_correct: index === 0,
      })
    )

    expect(() =>
      parseQuestionGenerationFinalBank(bytes(artifact), {
        itemType: 'MC',
        questionCount: 1,
        sourceSnapshot,
        expectedQuestionIds: ['q-M1-002'],
        result,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('rejects final-bank IDs that differ from the reviewed Plan', () => {
    const result = parseQuestionGenerationResult(bytes(completedResult()), {
      buildId: BUILD_ID,
      questionCount: 1,
    })

    expect(() =>
      parseQuestionGenerationFinalBank(
        bytes(finalBank({ id: 'q02', difficulty_status: 'llm_reviewed' })),
        {
          questionCount: 1,
          sourceSnapshot,
          expectedQuestionIds: ['q01'],
          result,
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('requires a known difficulty status for current result manifests', () => {
    const result = parseQuestionGenerationResult(bytes(completedResult()), {
      buildId: BUILD_ID,
      questionCount: 1,
    })

    expect(() =>
      parseQuestionGenerationFinalBank(
        bytes(finalBank({ difficulty_status: undefined })),
        {
          questionCount: 1,
          sourceSnapshot,
          expectedQuestionIds: ['q01'],
          result,
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
    expect(() =>
      parseQuestionGenerationFinalBank(
        bytes(finalBank({ difficulty_status: 'unknown' })),
        {
          questionCount: 1,
          sourceSnapshot,
          expectedQuestionIds: ['q01'],
          result,
        }
      )
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('accepts a legacy final bank without difficulty metadata', () => {
    const legacy = completedResult()
    delete legacy.requested_questions
    delete legacy.review_required_questions
    delete legacy.review_required_question_ids
    const result = parseQuestionGenerationResult(bytes(legacy), {
      buildId: BUILD_ID,
      questionCount: 1,
    })

    const questions = parseQuestionGenerationFinalBank(
      bytes(finalBank({ difficulty_status: undefined })),
      {
        questionCount: 1,
        sourceSnapshot,
        expectedQuestionIds: ['q01'],
        result,
      }
    )

    expect(questions[0]?.qualityFlags).toEqual(['weak_distractors'])
  })

  it('rejects current result quality metadata that differs from the final bank', () => {
    const result = parseQuestionGenerationResult(
      bytes(
        completedResult({
          status: 'completed_with_review',
          review_required_questions: 1,
          review_required_question_ids: ['q01'],
        })
      ),
      { buildId: BUILD_ID, questionCount: 1 }
    )

    expect(() =>
      parseQuestionGenerationFinalBank(bytes(finalBank()), {
        questionCount: 1,
        sourceSnapshot,
        expectedQuestionIds: ['q01'],
        result,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('preserves a validation failure as a bounded quality flag', () => {
    const result = parseQuestionGenerationResult(
      bytes(
        completedResult({
          status: 'completed_with_review',
          review_required_questions: 1,
          review_required_question_ids: ['q01'],
        })
      ),
      { buildId: BUILD_ID, questionCount: 1 }
    )

    const questions = parseQuestionGenerationFinalBank(
      bytes(finalBank({ difficulty_status: 'validation_failed' })),
      {
        questionCount: 1,
        sourceSnapshot,
        expectedQuestionIds: ['q01'],
        result,
      }
    )

    expect(questions[0]?.qualityFlags).toContain('difficulty_validation_failed')
    expect(JSON.stringify(questions)).not.toContain('difficulty_status')
  })

  it('rejects duplicate final-bank IDs against a two-question reviewed Plan', () => {
    const result = parseQuestionGenerationResult(
      bytes(
        completedResult({
          requested_questions: 2,
          generated_questions: 2,
        })
      ),
      { buildId: BUILD_ID, questionCount: 2 }
    )
    const first = finalBank().questions[0]!
    const artifact = {
      ...finalBank(),
      metadata: { ...finalBank().metadata, total_questions: 2 },
      questions: [first, { ...first }],
    }

    expect(() =>
      parseQuestionGenerationFinalBank(bytes(artifact), {
        questionCount: 2,
        sourceSnapshot,
        expectedQuestionIds: ['q01', 'q02'],
        result,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })

  it('truncates fallback names by Unicode grapheme without splitting them', () => {
    const family = '👨‍👩‍👧‍👦'
    const name = deriveGeneratedQuestionName(
      undefined,
      `${'a'.repeat(119)}${family}tail`
    )

    expect(name).toBe(`${'a'.repeat(119)}${family}`)
    expect(
      Array.from(
        new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(name)
      )
    ).toHaveLength(120)
  })

  it.each([
    finalBank({ origin_mode: 'reuse' }),
    finalBank({ item_format: undefined }),
    finalBank({ item_format: 'multiple_choice' }),
    finalBank({ bloom_level: 'create' }),
    finalBank({
      options: [
        {
          label: 'A',
          text: 'A',
          is_correct: true,
          explanation: 'A',
        },
        {
          label: 'B',
          text: 'B',
          is_correct: true,
          explanation: 'B',
        },
      ],
    }),
    finalBank({ correct_label: 'B' }),
    finalBank({
      options: [
        {
          label: 'A',
          text: 'A',
          is_correct: true,
          explanation: 'A',
        },
        { label: 'B', text: 'B', is_correct: false },
      ],
    }),
    finalBank({
      citations: [
        { sources: [{ file: 'unknown.pdf', pages: [1], chunk_ids: [] }] },
      ],
    }),
  ])('rejects an invalid final bank %#', (artifact) => {
    const result = parseQuestionGenerationResult(bytes(completedResult()), {
      buildId: BUILD_ID,
      questionCount: 1,
    })
    expect(() =>
      parseQuestionGenerationFinalBank(bytes(artifact), {
        questionCount: 1,
        sourceSnapshot,
        expectedQuestionIds: ['q01'],
        result,
      })
    ).toThrowError(expect.objectContaining({ code: 'ARTIFACT_INVALID' }))
  })
})
