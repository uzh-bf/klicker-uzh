import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { StringDecoder } from 'node:string_decoder'
import type {
  GeneratedQuestionCitation,
  GeneratedQuestionWithProvenance,
  KBGraphSourceSnapshot,
  QuestionGenerationArtifactRef,
  QuestionGenerationConfiguration,
  QuestionGenerationDesignSummary,
  QuestionGenerationItemType,
  QuestionGenerationPlanSummary,
  QuestionGenerationProvenanceIndex,
  QuestionGenerationQuestionProvenance,
  QuestionGenerationReviewSourceSummary,
  QuestionGenerationWarning,
} from '@klicker-uzh/types'
import { SaxesParser, type SaxesTagNS } from 'saxes'
import { parser as streamJsonParser, type Token } from 'stream-json/parser.js'
import { z } from 'zod'
import {
  QuestionGenerationServiceError,
  questionGenerationServiceError,
} from './questionGenerationErrors.js'

const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024
const MAX_GRAPH_EVIDENCE_ARTIFACT_BYTES = 512 * 1024 * 1024
const MAX_WARNING_COUNT = 100
const MAX_CITATION_SOURCES = 50
const MAX_REVIEW_CITATIONS = 8
const MAX_CHUNK_IDS = 200
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const AZURE_CONTAINER_PATTERN = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/
const NODE_ID_PATTERN = /^node_[0-9a-f]{32}$/
const RELATIONSHIP_ID_PATTERN = /^rel_[0-9a-f]{32}$/
const GRAPHML_NAMESPACE = 'http://graphml.graphdrawing.org/xmlns'
const BLOOM_LEVELS = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
] as const

function configuredItemType(
  configuration: QuestionGenerationConfiguration
): QuestionGenerationItemType {
  return configuration.itemType ?? 'SC'
}

function workerItemFormat(itemType: QuestionGenerationItemType) {
  if (itemType === 'KPRIM') return 'kprim'
  if (itemType === 'MC') return 'multiple_choice'
  return 'single_choice'
}

function workerMetadataItemFormat(itemType: QuestionGenerationItemType) {
  if (itemType === 'KPRIM') return 'kprim'
  if (itemType === 'MC') return 'mc'
  return 'sc'
}

function matchesConfiguredBloom(
  configuration: QuestionGenerationConfiguration,
  objectiveId: string | null,
  bloomLevel: (typeof BLOOM_LEVELS)[number]
) {
  if (objectiveId === null) {
    return configuration.bloomLevels.includes(bloomLevel)
  }

  const objective = configuration.objectives.find(
    (candidate) => candidate.id === objectiveId
  )
  return (
    objective !== undefined &&
    (objective.bloomLevel === null || objective.bloomLevel === bloomLevel)
  )
}

function matchesConfiguredDesignBloom(
  configuration: QuestionGenerationConfiguration,
  objectiveId: string | null,
  bloomLevel: (typeof BLOOM_LEVELS)[number] | null
) {
  if (bloomLevel !== null) {
    return matchesConfiguredBloom(configuration, objectiveId, bloomLevel)
  }
  if (objectiveId === null) return true

  return configuration.objectives.some(
    (objective) => objective.id === objectiveId && objective.bloomLevel === null
  )
}

function matchesWorkerArtifactFormat(
  format: 'SC' | 'MC' | 'MC5' | 'KPRIM',
  itemType: QuestionGenerationItemType,
  currentContract: boolean
) {
  if (itemType === 'KPRIM') return format === 'KPRIM'
  if (itemType === 'MC') return format === 'MC'
  return format === (currentContract ? 'SC' : 'MC5')
}

const boundedText = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength)
const canonicalIdentifier = (maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine(
      (value) => value === value.trim() && !/\p{C}/u.test(value),
      'Identifier must be canonical'
    )
const relativeBlobPath = canonicalIdentifier(1024).refine((value) => {
  const segments = value.split('/')
  return (
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !value.includes('?') &&
    !value.includes('#') &&
    segments.every((segment) => segment && segment !== '.' && segment !== '..')
  )
}, 'Blob path must be canonical')
const graphArtifactFilename = canonicalIdentifier(1024).refine(
  (value) => basename(value) === value && !value.includes('\\'),
  'Artifact filename must be canonical'
)
const artifactRefSchema = z
  .object({
    container_name: z.string().regex(AZURE_CONTAINER_PATTERN),
    blob_name: relativeBlobPath,
    sha256: z.string().regex(SHA256_PATTERN),
  })
  .strict()

const pinnedQuestionEvidenceSchema = z
  .object({
    schema_version: z.literal(1),
    graph_version_id: canonicalIdentifier(200),
    graph_manifest: artifactRefSchema,
    graphml: artifactRefSchema,
    vdb_chunks: artifactRefSchema,
    vdb_entities: artifactRefSchema.nullable(),
    vdb_relationships: artifactRefSchema.nullable(),
    instructor_assertions: artifactRefSchema.nullable(),
    instructor_assertion_index: artifactRefSchema.nullable(),
    resolved_domain_policy: artifactRefSchema,
    generation_recipe: artifactRefSchema,
    correction_set: artifactRefSchema.nullable(),
    correction_application_report: artifactRefSchema.nullable(),
    bundle_sha256: z.string().regex(SHA256_PATTERN),
    graph_sha256: z.string().regex(SHA256_PATTERN),
    domain_policy_digest: z.string().regex(SHA256_PATTERN),
    generation_recipe_digest: z.string().regex(SHA256_PATTERN),
    assertion_digests: z.array(z.string().regex(SHA256_PATTERN)).max(10_000),
    evidence_digest: z.string().regex(SHA256_PATTERN),
  })
  .strict()

const questionBlueprintWorkflowV1Schema = z
  .object({
    schema_version: z.literal(1),
    question_build_id: z.string().uuid(),
    generation_policy: z.literal('new_only'),
    requested_questions: z.number().int().min(1).max(20),
    frozen_graph_sha256: z.string().regex(SHA256_PATTERN),
    start_manifest_sha256: z.string().regex(SHA256_PATTERN),
  })
  .strict()

const questionBlueprintWorkflowV3Schema = questionBlueprintWorkflowV1Schema
  .omit({ schema_version: true })
  .extend({
    schema_version: z.literal(3),
    pinned_question_evidence: pinnedQuestionEvidenceSchema,
  })
  .strict()

const questionBlueprintWorkflowSchema = z.discriminatedUnion('schema_version', [
  questionBlueprintWorkflowV1Schema,
  questionBlueprintWorkflowV3Schema,
])

type PinnedQuestionEvidence = z.infer<typeof pinnedQuestionEvidenceSchema>

function canonicalJson(value: unknown): unknown {
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

function validPinnedQuestionEvidenceDigest(
  evidence: PinnedQuestionEvidence
): boolean {
  const { evidence_digest: expectedDigest, ...payload } = evidence
  const actualDigest = createHash('sha256')
    .update(JSON.stringify(canonicalJson(payload)))
    .digest('hex')
  return actualDigest === expectedDigest
}

function artifactRefMatches(
  actual: z.infer<typeof artifactRefSchema>,
  expected: QuestionGenerationArtifactRef
) {
  return (
    actual.container_name === expected.containerName &&
    actual.blob_name === expected.blobName &&
    actual.sha256 === expected.sha256
  )
}

function pinnedQuestionEvidenceMatches(
  evidence: PinnedQuestionEvidence,
  expected: {
    graphVersionId: string
    graphManifest: QuestionGenerationArtifactRef
    graphSha256: string
  }
) {
  const assertionDigests = evidence.assertion_digests
  const canonicalAssertionDigests = [...new Set(assertionDigests)].sort()
  return (
    validPinnedQuestionEvidenceDigest(evidence) &&
    evidence.graph_version_id === expected.graphVersionId &&
    artifactRefMatches(evidence.graph_manifest, expected.graphManifest) &&
    evidence.graph_sha256 === expected.graphSha256 &&
    evidence.graphml.sha256 === expected.graphSha256 &&
    (evidence.instructor_assertions === null) ===
      (evidence.instructor_assertion_index === null) &&
    assertionDigests.length === canonicalAssertionDigests.length &&
    assertionDigests.every(
      (digest, index) => digest === canonicalAssertionDigests[index]
    )
  )
}

const graphArtifactRefSchema = artifactRefSchema.extend({
  filename: graphArtifactFilename,
  size_bytes: z.number().int().min(0),
  content_type: boundedText(200),
})

const graphManifestV2Schema = z
  .object({
    schema_version: z.literal(2),
    course_id: canonicalIdentifier(200),
    storage_name: canonicalIdentifier(200),
    falkordb_graph_name: canonicalIdentifier(500),
    bundle_sha256: z.string().regex(SHA256_PATTERN),
    graph_sha256: z.string().regex(SHA256_PATTERN),
    domain_policy_digest: z.string().regex(SHA256_PATTERN),
    generation_recipe_digest: z.string().regex(SHA256_PATTERN),
    artifacts: z.array(graphArtifactRefSchema).min(1).max(100),
    policy: graphArtifactRefSchema,
    recipe: graphArtifactRefSchema,
    parent_bundle_sha256: z.string().regex(SHA256_PATTERN).nullable(),
    correction_set: graphArtifactRefSchema.nullable(),
    instructor_assertions: z.array(graphArtifactRefSchema).max(2),
  })
  .strict()

const provenanceSourceCitationSchema = z
  .object({
    element_type: z.enum(['node', 'relationship']),
    element_id: canonicalIdentifier(100),
    chunk_ids: z.array(canonicalIdentifier(500)).min(1).max(MAX_CHUNK_IDS),
    source_pages: z.array(canonicalIdentifier(1024)).max(200),
    lecture_markers: z.array(canonicalIdentifier(1024)).max(200),
  })
  .strict()

const provenanceAssertionCitationSchema = z
  .object({
    assertion_id: canonicalIdentifier(200),
    version: z.number().int().min(1),
  })
  .strict()

const questionProvenanceSchema = z
  .object({
    schema_version: z.literal(1),
    lineage_status: z.enum(['complete', 'legacy_incomplete']),
    graph_version_id: canonicalIdentifier(200).nullable(),
    bundle_sha256: z.string().regex(SHA256_PATTERN).nullable(),
    graph_sha256: z.string().regex(SHA256_PATTERN).nullable(),
    domain_policy_digest: z.string().regex(SHA256_PATTERN).nullable(),
    generation_recipe_digest: z.string().regex(SHA256_PATTERN).nullable(),
    node_ids: z.array(z.string().regex(NODE_ID_PATTERN)).max(500),
    relationship_ids: z
      .array(z.string().regex(RELATIONSHIP_ID_PATTERN))
      .max(500),
    source_citations: z.array(provenanceSourceCitationSchema).max(500),
    assertion_citations: z.array(provenanceAssertionCitationSchema).max(500),
  })
  .strict()

const provenanceIndexSchema = z
  .object({
    schema_version: z.literal(1),
    question_ids: z.array(canonicalIdentifier(200)).max(20),
    by_node_id: z.record(z.string(), z.array(canonicalIdentifier(200))),
    by_relationship_id: z.record(z.string(), z.array(canonicalIdentifier(200))),
    by_assertion_id: z.record(z.string(), z.array(canonicalIdentifier(200))),
    by_source_ref: z.record(z.string(), z.array(canonicalIdentifier(200))),
  })
  .strict()

const designSchema = z
  .object({
    schema_version: z.literal(1),
    state: z.enum(['resolved', 'approved']),
    assessment: z
      .object({
        id: boundedText(200),
        title: boundedText(500),
        language: boundedText(20),
        target_questions: z.number().int().min(1).max(20),
      })
      .passthrough(),
    objectives: z
      .array(
        z
          .object({
            module_id: boundedText(100),
            objective_id: boundedText(100),
            objective_text: boundedText(500),
          })
          .passthrough()
      )
      .max(20),
    modules: z
      .array(
        z
          .object({
            module_id: boundedText(100),
            module_name: boundedText(500),
          })
          .passthrough()
      )
      .min(1)
      .max(20),
    sources: z
      .array(
        z
          .object({
            module_id: boundedText(100),
            source_file: boundedText(1024),
            page_from: z.number().int().min(1),
            page_to: z.number().int().min(1),
          })
          .passthrough()
      )
      .max(100),
    resolved_slots: z
      .array(
        z
          .object({
            design_slot_id: boundedText(200),
            module_id: boundedText(100),
            objective_id: z.string().trim().max(100),
            origin_mode: z.string().optional(),
            allocated_origin_mode: z.string().optional(),
            item_format: z.enum(['single_choice', 'multiple_choice', 'kprim']),
            difficulty_scale: z.number().int().min(1).max(5),
            bloom_level: z.union([z.enum(BLOOM_LEVELS), z.literal('')]),
          })
          .passthrough()
      )
      .min(1)
      .max(20),
    topic_overview: z
      .object({
        coverage_warnings: z.array(boundedText(1000)).max(MAX_WARNING_COUNT),
      })
      .passthrough(),
    generation_policy: z.literal('new_only'),
    origin_counts: z
      .object({
        new: z.number().int().min(1).max(20),
        reuse: z.literal(0),
        update: z.literal(0),
      })
      .passthrough(),
  })
  .passthrough()

const planSchema = z
  .object({
    metadata: z
      .object({
        stage: z.literal('stems'),
        format: z.enum(['SC', 'MC', 'MC5', 'KPRIM']),
        item_format: z.enum(['sc', 'mc', 'kprim']).optional(),
        question_blueprint_workflow: questionBlueprintWorkflowSchema,
      })
      .passthrough(),
    questions: z
      .array(
        z
          .object({
            id: boundedText(200),
            module_id: boundedText(100),
            objective_id: z.string().trim().max(100),
            stem: boundedText(10_000),
            origin_mode: z.literal('new'),
            item_format: z.enum(['single_choice', 'multiple_choice', 'kprim']),
            bloom_level: z.enum(BLOOM_LEVELS),
            difficulty_scale: z.number().int().min(1).max(5),
            manual_review_required: z.boolean().optional(),
            verification_issues: z.array(boundedText(1000)).max(20).optional(),
            source_evidence: z
              .array(
                z
                  .object({
                    evidence_id: boundedText(100),
                    source_file: boundedText(1024),
                    page: z.number().int().min(1).nullable().optional(),
                  })
                  .passthrough()
              )
              .max(100),
            supporting_evidence_ids: z
              .array(boundedText(100))
              .min(1)
              .max(MAX_REVIEW_CITATIONS),
          })
          .passthrough()
      )
      .min(1)
      .max(20),
  })
  .strict()

const resultSchema = z
  .object({
    schema_version: z.union([z.literal(1), z.literal(2)]),
    question_build_id: z.string().uuid(),
    status: z.enum([
      'completed',
      'completed_with_review',
      'rejected',
      'failed',
    ]),
    generation_policy: z.literal('new_only'),
    requested_questions: z.number().int().min(1).max(20).nullable().optional(),
    generated_questions: z.number().int().min(0).max(20),
    final_questions: artifactRefSchema.nullable(),
    question_provenance_index: artifactRefSchema.nullable().optional(),
    review_required_questions: z.number().int().min(0).max(20).optional(),
    review_required_question_ids: z
      .array(canonicalIdentifier(200))
      .max(20)
      .optional(),
    rejected_at: z.enum(['design_review', 'plan_review']).nullable(),
    reviewed_by: boundedText(200).nullable(),
  })
  .strict()

const finalQuestionSchema = z
  .object({
    id: canonicalIdentifier(200),
    title: boundedText(500).optional(),
    stem: boundedText(10_000),
    context_inline: z.string().trim().max(20_000).nullable().optional(),
    explanation: z.string().trim().max(20_000).nullable().optional(),
    bloom_level: z.enum(BLOOM_LEVELS),
    origin_mode: z.literal('new'),
    item_format: z.enum(['single_choice', 'multiple_choice', 'kprim']),
    difficulty_scale: z.number().int().min(1).max(5),
    target_difficulty_scale: z.number().int().min(1).max(5).optional(),
    predicted_difficulty_scale: z.number().min(1).max(5).nullable().optional(),
    difficulty_quality_flags: z.array(boundedText(100)).max(50).optional(),
    difficulty_status: z
      .enum(['llm_reviewed', 'review_required', 'validation_failed'])
      .optional(),
    manual_review_required: z.boolean().optional(),
    options: z
      .array(
        z
          .object({
            label: boundedText(20),
            text: boundedText(10_000),
            is_correct: z.boolean(),
            explanation: z.string().trim().max(10_000).nullable().optional(),
          })
          .passthrough()
      )
      .min(2)
      .max(10)
      .optional(),
    correct_label: boundedText(20).optional(),
    statements: z
      .array(
        z
          .object({
            text: boundedText(10_000),
            is_correct: z.boolean(),
            explanation: z.string().trim().max(10_000).nullable().optional(),
          })
          .passthrough()
      )
      .length(4)
      .optional(),
    citations: z
      .array(
        z
          .object({
            sources: z
              .array(
                z
                  .object({
                    file: boundedText(1024),
                    pages: z.array(z.number().int().min(1)).max(100).optional(),
                    chunk_ids: z
                      .array(boundedText(500))
                      .max(MAX_CHUNK_IDS)
                      .optional(),
                  })
                  .passthrough()
              )
              .max(MAX_CITATION_SOURCES),
          })
          .passthrough()
      )
      .max(MAX_CITATION_SOURCES),
    provenance: questionProvenanceSchema.optional(),
  })
  .passthrough()

const finalBankSchema = z
  .object({
    metadata: z
      .object({
        format: z.enum(['SC', 'MC', 'MC5', 'KPRIM']),
        item_format: z.enum(['sc', 'mc', 'kprim']).optional(),
        total_questions: z.number().int().min(1).max(20),
      })
      .passthrough(),
    questions: z.array(finalQuestionSchema).min(1).max(20),
  })
  .strict()

export type QuestionGenerationResultManifest = {
  schemaVersion: 1 | 2
  status: 'completed' | 'completed_with_review' | 'rejected' | 'failed'
  requestedQuestions: number | null
  generatedQuestions: number
  finalQuestions: QuestionGenerationArtifactRef | null
  questionProvenanceIndex: QuestionGenerationArtifactRef | null
  reviewRequiredQuestions: number
  reviewRequiredQuestionIds: string[]
  legacyCompleted: boolean
  rejectedAt: 'design_review' | 'plan_review' | null
  reviewedBy: string | null
}

export type QuestionGenerationGraphLineage = {
  graphVersionId: string
  bundleSha256: string
  graphSha256: string
  domainPolicyDigest: string
  generationRecipeDigest: string
}

export type QuestionGenerationGraphEvidence = QuestionGenerationGraphLineage & {
  graphArtifact: QuestionGenerationArtifactRef
  chunksArtifact: QuestionGenerationArtifactRef
}

export type QuestionGenerationProvenanceAuthority = {
  nodeIds: ReadonlySet<string>
  relationshipIds: ReadonlySet<string>
  chunkIds: ReadonlySet<string>
}

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized || null
}

function normalizedPlainText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[`*_~>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function deriveGeneratedQuestionName(
  title: string | undefined,
  stem: string
): string {
  const value = normalizedPlainText(title?.trim() || stem)
  if (!value) return artifactError('Generated question has no usable name')

  const segments = new Intl.Segmenter('und', {
    granularity: 'grapheme',
  }).segment(value)
  return Array.from(segments, (segment) => segment.segment)
    .slice(0, 120)
    .join('')
}

function citationFileKey(value: string): string {
  return basename(value.replaceAll('\\', '/')).toLocaleLowerCase('en')
}

function registeredSourcesByFile(
  sourceSnapshot: KBGraphSourceSnapshot
): Map<string, KBGraphSourceSnapshot[number] | null> {
  const sourcesByFile = new Map<string, KBGraphSourceSnapshot[number] | null>()
  for (const source of sourceSnapshot) {
    const key = citationFileKey(source.sourceFile)
    sourcesByFile.set(key, sourcesByFile.has(key) ? null : source)
  }
  return sourcesByFile
}

function normalizeReviewSource(
  sourceFile: string,
  pageFrom: number | null,
  pageTo: number | null,
  sourcesByFile: Map<string, KBGraphSourceSnapshot[number] | null>
): QuestionGenerationReviewSourceSummary {
  const source = sourcesByFile.get(citationFileKey(sourceFile))
  if (!source) {
    return artifactError(
      'Question-generation evidence does not match a registered graph source'
    )
  }
  if (
    (pageFrom === null) !== (pageTo === null) ||
    (pageFrom !== null &&
      pageTo !== null &&
      (pageFrom > pageTo ||
        (source.pageCount !== null && pageTo > source.pageCount)))
  ) {
    return artifactError(
      'Question-generation evidence exceeds its registered graph source'
    )
  }
  return {
    sourceFile: basename(source.sourceFile.replaceAll('\\', '/')),
    pageFrom,
    pageTo,
  }
}

function normalizeCitations(
  citations: z.infer<typeof finalQuestionSchema>['citations'],
  sourceSnapshot: KBGraphSourceSnapshot
): GeneratedQuestionCitation[] {
  const sourcesByFile = registeredSourcesByFile(sourceSnapshot)

  const collected = new Map<
    string,
    {
      source: KBGraphSourceSnapshot[number]
      pages: Set<number>
      chunkIds: Set<string>
    }
  >()
  for (const citation of citations) {
    for (const rawSource of citation.sources) {
      const source = sourcesByFile.get(citationFileKey(rawSource.file))
      if (!source) {
        return artifactError(
          'Generated question citation does not match a registered graph source'
        )
      }
      const entry = collected.get(source.resourceId) ?? {
        source,
        pages: new Set<number>(),
        chunkIds: new Set<string>(),
      }
      for (const page of rawSource.pages ?? []) {
        if (source.pageCount !== null && page > source.pageCount) {
          return artifactError(
            'Generated question citation exceeds its registered source'
          )
        }
        entry.pages.add(page)
      }
      for (const chunkId of rawSource.chunk_ids ?? []) {
        entry.chunkIds.add(chunkId)
      }
      if (entry.chunkIds.size > MAX_CHUNK_IDS) {
        return artifactError('Generated question contains too many chunk IDs')
      }
      collected.set(source.resourceId, entry)
    }
  }

  return sourceSnapshot.flatMap((source) => {
    const entry = collected.get(source.resourceId)
    if (!entry) return []
    const pages = [...entry.pages].sort((left, right) => left - right)
    return [
      {
        resourceId: source.resourceId,
        sourceFile: source.sourceFile,
        pageFrom: pages[0] ?? null,
        pageTo: pages.at(-1) ?? null,
        chunkIds: [...entry.chunkIds].sort(),
      },
    ]
  })
}

function sortedUnique(values: string[], field: string): string[] {
  const normalized = [...new Set(values)].sort()
  if (normalized.length !== values.length) {
    return artifactError(`Question provenance contains duplicate ${field}`)
  }
  return normalized
}

function graphAttribute(tag: SaxesTagNS, name: string): string | null {
  const attribute = Object.values(tag.attributes).find(
    (candidate) => candidate.uri === '' && candidate.local === name
  )
  return attribute?.value ?? null
}

function isGraphmlElement(
  element: Pick<SaxesTagNS, 'local' | 'uri'> | undefined,
  local: string
): boolean {
  return element?.uri === GRAPHML_NAMESPACE && element.local === local
}

async function verifyClaimedGraphIdentities(
  chunks: AsyncIterable<Buffer>,
  claims: QuestionGenerationProvenanceAuthority
): Promise<void> {
  const foundNodeIds = new Set<string>()
  const foundRelationshipIds = new Set<string>()
  const decoder = new StringDecoder('utf8')
  const parser = new SaxesParser({ xmlns: true, position: false })
  let byteCount = 0
  let graphCount = 0
  let rootSeen = false
  let nodeKey: string | null = null
  let relationshipKey: string | null = null
  const elementStack: Array<Pick<SaxesTagNS, 'local' | 'uri'>> = []
  let identityType: 'node' | 'relationship' | null = null
  let identityDepth: number | null = null
  let identityText: string | null = null

  const setIdentityKey = (
    current: string | null,
    value: string | null,
    field: string
  ) => {
    if (!value || current !== null) {
      return artifactError(`Pinned GraphML has no canonical ${field} key`)
    }
    return value
  }
  const appendIdentityText = (value: string) => {
    if (identityText === null) return
    identityText += value
    if (identityText.length > 100) {
      return artifactError('Pinned GraphML contains an invalid stable identity')
    }
  }

  parser.on('doctype', () =>
    artifactError('Pinned GraphML must not contain a document type')
  )
  parser.on('opentag', (tag) => {
    const parent = elementStack.at(-1)
    const grandparent = elementStack.at(-2)
    if (elementStack.length === 0) {
      if (!isGraphmlElement(tag, 'graphml')) {
        return artifactError('Pinned GraphML has no canonical root element')
      }
      rootSeen = true
    }
    if (identityText !== null) {
      return artifactError('Pinned GraphML contains an invalid stable identity')
    }
    if (
      elementStack.length === 1 &&
      isGraphmlElement(tag, 'graph') &&
      isGraphmlElement(parent, 'graphml')
    ) {
      graphCount += 1
    }
    if (
      elementStack.length === 1 &&
      isGraphmlElement(tag, 'key') &&
      isGraphmlElement(parent, 'graphml')
    ) {
      const target = graphAttribute(tag, 'for')
      const name = graphAttribute(tag, 'attr.name')
      if ((target === 'node' || target === 'all') && name === 'kg_node_id') {
        nodeKey = setIdentityKey(
          nodeKey,
          graphAttribute(tag, 'id'),
          'kg_node_id'
        )
      }
      if (
        (target === 'edge' || target === 'all') &&
        name === 'kg_relationship_id'
      ) {
        relationshipKey = setIdentityKey(
          relationshipKey,
          graphAttribute(tag, 'id'),
          'kg_relationship_id'
        )
      }
    } else if (
      elementStack.length === 3 &&
      isGraphmlElement(tag, 'data') &&
      isGraphmlElement(grandparent, 'graph') &&
      ((isGraphmlElement(parent, 'node') &&
        graphAttribute(tag, 'key') === nodeKey) ||
        (isGraphmlElement(parent, 'edge') &&
          graphAttribute(tag, 'key') === relationshipKey))
    ) {
      identityType = isGraphmlElement(parent, 'node') ? 'node' : 'relationship'
      identityDepth = elementStack.length + 1
      identityText = ''
    }
    elementStack.push({ local: tag.local, uri: tag.uri })
  })
  parser.on('text', appendIdentityText)
  parser.on('cdata', appendIdentityText)
  parser.on('closetag', (tag) => {
    if (
      isGraphmlElement(tag, 'data') &&
      identityText !== null &&
      identityDepth === elementStack.length
    ) {
      const value = identityText
      identityText = null
      identityDepth = null
      const target =
        identityType === 'node' ? claims.nodeIds : claims.relationshipIds
      const found =
        identityType === 'node' ? foundNodeIds : foundRelationshipIds
      identityType = null
      if (target.has(value)) {
        if (found.has(value)) {
          return artifactError(
            'Pinned GraphML contains duplicate claimed stable identities'
          )
        }
        found.add(value)
      }
    }
    elementStack.pop()
  })

  try {
    for await (const chunk of chunks) {
      byteCount += chunk.byteLength
      if (byteCount > MAX_GRAPH_EVIDENCE_ARTIFACT_BYTES) {
        return artifactError('Pinned GraphML exceeds the supported size')
      }
      parser.write(decoder.write(chunk))
    }
    parser.write(decoder.end()).close()
  } catch (error) {
    if (error instanceof QuestionGenerationServiceError) throw error
    return artifactError('Pinned GraphML is not supported')
  }
  if (
    byteCount === 0 ||
    !rootSeen ||
    graphCount !== 1 ||
    (claims.nodeIds.size > 0 && nodeKey === null) ||
    (claims.relationshipIds.size > 0 && relationshipKey === null) ||
    foundNodeIds.size !== claims.nodeIds.size ||
    foundRelationshipIds.size !== claims.relationshipIds.size
  ) {
    return artifactError(
      'Question provenance cites elements outside the pinned graph'
    )
  }
}

async function verifyClaimedChunkIdentities(
  chunks: AsyncIterable<Buffer>,
  claims: ReadonlySet<string>
): Promise<void> {
  const found = new Set<string>()
  let byteCount = 0
  type ObjectContext = {
    kind: 'object'
    role: 'root' | 'record' | 'other'
    pendingKey: string | null
    pendingKeyIgnored: boolean
    idKeySeen: boolean
    idValueSeen: boolean
  }
  type ArrayContext = { kind: 'array'; role: 'data' | 'other' }
  type JsonContext = ObjectContext | ArrayContext
  type ValueRole = 'root' | 'record' | 'data' | 'chunk-id' | 'other'

  const stack: JsonContext[] = []
  let rootSeen = false
  let rootClosed = false
  let dataSeen = false
  let stringRole: ValueRole | null = null
  let stringValue = ''
  let stringTooLong = false
  let inKey = false
  let keyValue = ''
  let keyTooLong = false

  const startValue = (
    kind: 'object' | 'array' | 'string' | 'primitive'
  ): ValueRole => {
    const parent = stack.at(-1)
    if (!parent) {
      if (rootSeen || kind !== 'object') {
        return artifactError('Pinned chunk store has no canonical root object')
      }
      rootSeen = true
      return 'root'
    }
    if (parent.kind === 'array') {
      if (parent.role === 'data') {
        if (kind !== 'object') {
          return artifactError('Pinned chunk store has an invalid data record')
        }
        return 'record'
      }
      return 'other'
    }

    const key = parent.pendingKey
    const keyIgnored = parent.pendingKeyIgnored
    parent.pendingKey = null
    parent.pendingKeyIgnored = false
    if (key === null && !keyIgnored) {
      return artifactError('Pinned chunk store has an invalid object value')
    }
    if (keyIgnored) return 'other'
    if (parent.role === 'root' && key === 'data') {
      if (dataSeen || kind !== 'array') {
        return artifactError('Pinned chunk store has no canonical data array')
      }
      dataSeen = true
      return 'data'
    }
    if (parent.role === 'record' && key === '__id__') {
      if (parent.idKeySeen || kind !== 'string') {
        return artifactError('Pinned chunk store has an invalid chunk identity')
      }
      parent.idKeySeen = true
      return 'chunk-id'
    }
    return 'other'
  }

  const processToken = (token: Token) => {
    switch (token.name) {
      case 'startObject': {
        const role = startValue('object')
        stack.push({
          kind: 'object',
          role: role === 'root' || role === 'record' ? role : 'other',
          pendingKey: null,
          pendingKeyIgnored: false,
          idKeySeen: false,
          idValueSeen: false,
        })
        break
      }
      case 'endObject': {
        const context = stack.pop()
        if (context?.kind !== 'object') {
          return artifactError('Pinned chunk store has invalid structure')
        }
        if (context.role === 'record' && !context.idValueSeen) {
          return artifactError('Pinned chunk store has an invalid data record')
        }
        if (context.role === 'root') rootClosed = true
        break
      }
      case 'startArray': {
        const role = startValue('array')
        stack.push({ kind: 'array', role: role === 'data' ? 'data' : 'other' })
        break
      }
      case 'endArray': {
        if (stack.pop()?.kind !== 'array') {
          return artifactError('Pinned chunk store has invalid structure')
        }
        break
      }
      case 'startKey': {
        const context = stack.at(-1)
        if (
          context?.kind !== 'object' ||
          context.pendingKey !== null ||
          context.pendingKeyIgnored ||
          inKey
        ) {
          return artifactError('Pinned chunk store has invalid structure')
        }
        inKey = true
        keyValue = ''
        keyTooLong = false
        break
      }
      case 'endKey': {
        const context = stack.at(-1)
        if (context?.kind !== 'object' || !inKey) {
          return artifactError('Pinned chunk store has invalid structure')
        }
        inKey = false
        if (keyTooLong) context.pendingKeyIgnored = true
        else context.pendingKey = keyValue
        break
      }
      case 'startString':
        stringRole = startValue('string')
        stringValue = ''
        stringTooLong = false
        break
      case 'stringChunk':
        if (inKey) {
          if (keyValue.length + token.value.length > 32) keyTooLong = true
          else keyValue += token.value
        } else if (stringRole === 'chunk-id') {
          if (stringValue.length + token.value.length > 500) {
            stringTooLong = true
          } else {
            stringValue += token.value
          }
        }
        break
      case 'endString': {
        if (stringRole === 'chunk-id') {
          if (
            stringTooLong ||
            stringValue.length === 0 ||
            stringValue !== stringValue.trim() ||
            /\p{C}/u.test(stringValue)
          ) {
            return artifactError(
              'Pinned chunk store has an invalid chunk identity'
            )
          }
          const context = stack.at(-1)
          if (context?.kind !== 'object' || context.role !== 'record') {
            return artifactError('Pinned chunk store has invalid structure')
          }
          context.idValueSeen = true
          if (claims.has(stringValue)) {
            if (found.has(stringValue)) {
              return artifactError(
                'Pinned chunk store contains duplicate claimed identities'
              )
            }
            found.add(stringValue)
          }
        }
        stringRole = null
        break
      }
      case 'startNumber':
      case 'nullValue':
      case 'trueValue':
      case 'falseValue':
        startValue('primitive')
        break
      case 'endNumber':
      case 'numberChunk':
      case 'numberValue':
      case 'whitespace':
        break
      case 'keyValue':
      case 'stringValue':
        return artifactError('Pinned chunk store emitted an unsupported token')
    }
  }

  async function* boundedChunks(): AsyncIterable<Buffer> {
    for await (const chunk of chunks) {
      byteCount += chunk.byteLength
      if (byteCount > MAX_GRAPH_EVIDENCE_ARTIFACT_BYTES) {
        return artifactError('Pinned chunk store exceeds the supported size')
      }
      yield chunk
    }
  }

  try {
    await pipeline(
      Readable.from(boundedChunks()),
      streamJsonParser.asStream({
        packKeys: false,
        packStrings: false,
        packNumbers: false,
        streamKeys: true,
        streamStrings: true,
        streamNumbers: false,
      }),
      async (source) => {
        for await (const token of source as AsyncIterable<Token>) {
          processToken(token)
        }
      }
    )
  } catch (error) {
    if (error instanceof QuestionGenerationServiceError) throw error
    return artifactError('Pinned chunk store is not supported')
  }
  if (
    byteCount === 0 ||
    !rootSeen ||
    !rootClosed ||
    !dataSeen ||
    stack.length !== 0 ||
    inKey ||
    stringRole !== null ||
    found.size !== claims.size
  ) {
    return artifactError(
      'Question provenance cites chunks outside the pinned graph evidence'
    )
  }
}

export function parseQuestionGenerationProvenanceClaims(
  bytes: Buffer
): QuestionGenerationProvenanceAuthority {
  const parsed = finalBankSchema.safeParse(parseArtifactJson(bytes))
  if (!parsed.success) {
    return artifactError('Final question bank is unsupported')
  }
  const nodeIds = new Set<string>()
  const relationshipIds = new Set<string>()
  const chunkIds = new Set<string>()
  for (const question of parsed.data.questions) {
    for (const nodeId of question.provenance?.node_ids ?? []) {
      nodeIds.add(nodeId)
    }
    for (const relationshipId of question.provenance?.relationship_ids ?? []) {
      relationshipIds.add(relationshipId)
    }
    for (const citation of question.provenance?.source_citations ?? []) {
      for (const chunkId of citation.chunk_ids) chunkIds.add(chunkId)
    }
    for (const citation of question.citations) {
      for (const source of citation.sources) {
        for (const chunkId of source.chunk_ids ?? []) chunkIds.add(chunkId)
      }
    }
  }
  return { nodeIds, relationshipIds, chunkIds }
}

export async function verifyQuestionGenerationProvenanceAuthority(
  graphChunks: AsyncIterable<Buffer>,
  chunkStoreChunks: AsyncIterable<Buffer>,
  claims: QuestionGenerationProvenanceAuthority
): Promise<QuestionGenerationProvenanceAuthority> {
  await verifyClaimedGraphIdentities(graphChunks, claims)
  await verifyClaimedChunkIdentities(chunkStoreChunks, claims.chunkIds)
  return claims
}

function normalizeQuestionProvenance(
  raw: z.infer<typeof questionProvenanceSchema> | undefined,
  expected: QuestionGenerationGraphLineage | null,
  authority: QuestionGenerationProvenanceAuthority | null,
  sourceSnapshot: KBGraphSourceSnapshot
): QuestionGenerationQuestionProvenance | null {
  if (expected === null) {
    if (raw === undefined) return null
    if (
      raw.lineage_status !== 'legacy_incomplete' ||
      raw.graph_version_id !== null ||
      raw.bundle_sha256 !== null ||
      raw.graph_sha256 !== null ||
      raw.domain_policy_digest !== null ||
      raw.generation_recipe_digest !== null ||
      raw.node_ids.length > 0 ||
      raw.relationship_ids.length > 0 ||
      raw.source_citations.length > 0 ||
      raw.assertion_citations.length > 0
    ) {
      return artifactError('Legacy question provenance claims graph evidence')
    }
  } else if (
    authority === null ||
    raw === undefined ||
    raw.lineage_status !== 'complete' ||
    raw.graph_version_id !== expected.graphVersionId ||
    raw.bundle_sha256 !== expected.bundleSha256 ||
    raw.graph_sha256 !== expected.graphSha256 ||
    raw.domain_policy_digest !== expected.domainPolicyDigest ||
    raw.generation_recipe_digest !== expected.generationRecipeDigest ||
    (raw.node_ids.length === 0 && raw.relationship_ids.length === 0) ||
    raw.source_citations.length === 0
  ) {
    return artifactError(
      'Question provenance does not match the pinned graph lineage'
    )
  }
  if (!raw) return null
  if (raw.assertion_citations.length > 0) {
    return artifactError(
      'Instructor Assertion provenance is not enabled for question generation'
    )
  }

  const nodeIds = sortedUnique(raw.node_ids, 'node IDs')
  const relationshipIds = sortedUnique(raw.relationship_ids, 'relationship IDs')
  if (
    authority !== null &&
    (nodeIds.some((nodeId) => !authority.nodeIds.has(nodeId)) ||
      relationshipIds.some(
        (relationshipId) => !authority.relationshipIds.has(relationshipId)
      ))
  ) {
    return artifactError(
      'Question provenance cites elements outside the pinned graph'
    )
  }
  const selectedIds = new Set([...nodeIds, ...relationshipIds])
  const sourcesByFile = registeredSourcesByFile(sourceSnapshot)
  const seenSourceElements = new Set<string>()
  const sourceCitations = raw.source_citations.map((citation) => {
    const expectedPattern =
      citation.element_type === 'node'
        ? NODE_ID_PATTERN
        : RELATIONSHIP_ID_PATTERN
    if (
      !expectedPattern.test(citation.element_id) ||
      !selectedIds.has(citation.element_id) ||
      (authority !== null &&
        !(
          citation.element_type === 'node'
            ? authority.nodeIds
            : authority.relationshipIds
        ).has(citation.element_id)) ||
      seenSourceElements.has(`${citation.element_type}:${citation.element_id}`)
    ) {
      return artifactError('Question provenance cites an invalid graph element')
    }
    seenSourceElements.add(`${citation.element_type}:${citation.element_id}`)
    const chunkIds = sortedUnique(citation.chunk_ids, 'chunk IDs')
    if (
      authority !== null &&
      chunkIds.some((chunkId) => !authority.chunkIds.has(chunkId))
    ) {
      return artifactError(
        'Question provenance cites chunks outside the pinned graph evidence'
      )
    }
    const sourcePages = sortedUnique(citation.source_pages, 'source pages')
    for (const marker of sourcePages) {
      const match = /^(.+)#page=([1-9][0-9]*)$/.exec(marker)
      const source = match
        ? sourcesByFile.get(citationFileKey(match[1]!))
        : undefined
      const page = match ? Number(match[2]) : Number.NaN
      if (
        !source ||
        !Number.isSafeInteger(page) ||
        (source.pageCount !== null && page > source.pageCount)
      ) {
        return artifactError(
          'Question provenance source pages do not match a registered source'
        )
      }
    }
    return {
      elementType: citation.element_type,
      elementId: citation.element_id,
      chunkIds,
      sourcePages,
      lectureMarkers: sortedUnique(citation.lecture_markers, 'lecture markers'),
    }
  })

  const seenAssertions = new Set<string>()
  const assertionCitations = raw.assertion_citations
    .map((citation) => {
      const key = `${citation.assertion_id}:${citation.version}`
      if (seenAssertions.has(key)) {
        return artifactError(
          'Question provenance contains duplicate Instructor Assertions'
        )
      }
      seenAssertions.add(key)
      return {
        assertionId: citation.assertion_id,
        version: citation.version,
      }
    })
    .sort(
      (left, right) =>
        left.assertionId.localeCompare(right.assertionId) ||
        left.version - right.version
    )

  return {
    schemaVersion: 1,
    lineageStatus: raw.lineage_status,
    graphVersionId: raw.graph_version_id,
    bundleSha256: raw.bundle_sha256,
    graphSha256: raw.graph_sha256,
    domainPolicyDigest: raw.domain_policy_digest,
    generationRecipeDigest: raw.generation_recipe_digest,
    nodeIds,
    relationshipIds,
    sourceCitations,
    assertionCitations,
  }
}

function normalizeFinalQuestion(
  question: z.infer<typeof finalQuestionSchema>,
  itemType: QuestionGenerationItemType,
  sourceSnapshot: KBGraphSourceSnapshot,
  expectedLineage: QuestionGenerationGraphLineage | null,
  provenanceAuthority: QuestionGenerationProvenanceAuthority | null
): GeneratedQuestionWithProvenance {
  if (question.item_format !== workerItemFormat(itemType)) {
    return artifactError('Generated question type does not match the build')
  }
  if (
    question.target_difficulty_scale !== undefined &&
    question.target_difficulty_scale !== question.difficulty_scale
  ) {
    return artifactError('Generated question target difficulty changed')
  }

  if (
    (itemType === 'SC' &&
      (!question.options ||
        !question.correct_label ||
        question.statements !== undefined)) ||
    (itemType === 'MC' &&
      (!question.options ||
        question.correct_label !== undefined ||
        question.statements !== undefined)) ||
    (itemType === 'KPRIM' &&
      (!question.statements ||
        question.options !== undefined ||
        question.correct_label !== undefined))
  ) {
    return artifactError(
      'Generated question answer shape does not match its type'
    )
  }

  const choices =
    itemType !== 'KPRIM'
      ? question.options!.map((option) => ({
          id: option.label.toUpperCase(),
          label: option.label.toUpperCase(),
          text: option.text.trim(),
          correct: option.is_correct,
          feedback: optionalText(option.explanation),
        }))
      : question.statements!.map((statement, index) => ({
          id: String.fromCharCode(65 + index),
          label: String.fromCharCode(65 + index),
          text: statement.text.trim(),
          correct: statement.is_correct,
          feedback: optionalText(statement.explanation),
        }))
  if (
    new Set(choices.map((choice) => choice.id)).size !== choices.length ||
    new Set(choices.map((choice) => choice.text.toLowerCase())).size !==
      choices.length ||
    choices.some((choice) => !choice.text) ||
    (itemType === 'SC' &&
      (choices.filter((choice) => choice.correct).length !== 1 ||
        choices.find((choice) => choice.correct)?.label !==
          question.correct_label!.toUpperCase())) ||
    (itemType === 'MC' &&
      (choices.length !== 5 ||
        choices.map((choice) => choice.label).join('') !== 'ABCDE' ||
        choices.filter((choice) => choice.correct).length < 2 ||
        choices.filter((choice) => choice.correct).length > 4))
  ) {
    return artifactError('Generated question choices are inconsistent')
  }
  const feedbackCount = choices.filter(
    (choice) => choice.feedback !== null
  ).length
  if (feedbackCount !== 0 && feedbackCount !== choices.length) {
    return artifactError('Generated question feedback is incomplete')
  }

  const qualityFlags = [...(question.difficulty_quality_flags ?? [])]
  if (question.difficulty_status === 'review_required') {
    qualityFlags.push('difficulty_review_required')
  } else if (question.difficulty_status === 'validation_failed') {
    qualityFlags.push('difficulty_validation_failed')
  }
  if (question.manual_review_required) {
    qualityFlags.push('manual_review_required')
  }

  const citations = normalizeCitations(question.citations, sourceSnapshot)
  if (
    provenanceAuthority !== null &&
    citations.some((citation) =>
      citation.chunkIds.some(
        (chunkId) => !provenanceAuthority.chunkIds.has(chunkId)
      )
    )
  ) {
    return artifactError(
      'Generated question cites chunks outside the pinned graph evidence'
    )
  }
  return {
    itemType,
    sourceQuestionId: question.id,
    name: deriveGeneratedQuestionName(question.title, question.stem),
    stem: question.stem.trim(),
    context: optionalText(question.context_inline),
    explanation: optionalText(question.explanation),
    choices,
    bloomLevel: question.bloom_level,
    targetDifficulty:
      question.target_difficulty_scale ?? question.difficulty_scale,
    predictedDifficulty: question.predicted_difficulty_scale ?? null,
    qualityFlags: [...new Set(qualityFlags)].sort(),
    citations,
    provenance: normalizeQuestionProvenance(
      question.provenance,
      expectedLineage,
      provenanceAuthority,
      sourceSnapshot
    ),
  }
}

function artifactError(message: string): never {
  throw questionGenerationServiceError('ARTIFACT_INVALID', message)
}

function parseArtifactJson(bytes: Buffer): unknown {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ARTIFACT_BYTES) {
    return artifactError('Question-generation artifact has an invalid size')
  }
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch {
    return artifactError('Question-generation artifact is not valid JSON')
  }
}

function toArtifactRef(
  value: z.infer<typeof artifactRefSchema>
): QuestionGenerationArtifactRef {
  return {
    containerName: value.container_name,
    blobName: value.blob_name,
    sha256: value.sha256,
  }
}

function warning(code: string, message: string): QuestionGenerationWarning {
  return { code, message }
}

export function parseQuestionGenerationGraphManifest(
  bytes: Buffer,
  expected: {
    graphVersionId: string
    storageName: string
    falkordbGraphName: string
    bundleSha256: string
    graphSha256: string
  }
): QuestionGenerationGraphEvidence {
  const parsed = graphManifestV2Schema.safeParse(parseArtifactJson(bytes))
  if (!parsed.success) {
    return artifactError('Question-generation graph manifest is unsupported')
  }
  const manifest = parsed.data
  const inventoryKey = (artifact: z.infer<typeof graphArtifactRefSchema>) =>
    JSON.stringify(artifact)
  const inventoryKeys = manifest.artifacts.map((artifact) =>
    inventoryKey(artifact)
  )
  const referencedKeys = [
    manifest.policy,
    manifest.recipe,
    ...(manifest.correction_set ? [manifest.correction_set] : []),
    ...manifest.instructor_assertions,
  ].map((artifact) => inventoryKey(artifact))
  const assertionFileNames = new Set(
    manifest.instructor_assertions.map((artifact) => artifact.filename)
  )
  const artifactFileNames = manifest.artifacts.map(
    (artifact) => artifact.filename
  )
  const graphArtifacts = manifest.artifacts.filter(
    (artifact) => artifact.filename === 'graph_chunk_entity_relation.graphml'
  )
  const chunkArtifacts = manifest.artifacts.filter(
    (artifact) => artifact.filename === 'vdb_chunks.json'
  )
  if (
    // Native graph dispatch uses the canonical KBGraphBuild id for both the
    // worker course_id and storage_name; the KB id remains encoded in the
    // canonical FalkorDB graph name.
    manifest.course_id !== expected.graphVersionId ||
    manifest.storage_name !== expected.storageName ||
    manifest.falkordb_graph_name !== expected.falkordbGraphName ||
    manifest.bundle_sha256 !== expected.bundleSha256 ||
    manifest.graph_sha256 !== expected.graphSha256 ||
    new Set(inventoryKeys).size !== inventoryKeys.length ||
    new Set(artifactFileNames).size !== artifactFileNames.length ||
    manifest.artifacts.some(
      (artifact) => basename(artifact.blob_name) !== artifact.filename
    ) ||
    referencedKeys.some((key) => !inventoryKeys.includes(key)) ||
    graphArtifacts.length !== 1 ||
    chunkArtifacts.length !== 1 ||
    graphArtifacts[0]?.sha256 !== expected.graphSha256 ||
    (assertionFileNames.size > 0 &&
      (assertionFileNames.size !== 2 ||
        !assertionFileNames.has('instructor_assertions.json') ||
        !assertionFileNames.has('vdb_instructor_assertions.json'))) ||
    (manifest.parent_bundle_sha256 === null) !==
      (manifest.correction_set === null)
  ) {
    return artifactError(
      'Question-generation graph manifest does not match its registered version'
    )
  }

  return {
    graphVersionId: expected.graphVersionId,
    bundleSha256: manifest.bundle_sha256,
    graphSha256: manifest.graph_sha256,
    domainPolicyDigest: manifest.domain_policy_digest,
    generationRecipeDigest: manifest.generation_recipe_digest,
    graphArtifact: toArtifactRef(graphArtifacts[0]!),
    chunksArtifact: toArtifactRef(chunkArtifacts[0]!),
  }
}

export function parseQuestionGenerationDesign(
  bytes: Buffer,
  expected: {
    buildId: string
    configuration: QuestionGenerationConfiguration
    sourceSnapshot: KBGraphSourceSnapshot
  }
): QuestionGenerationDesignSummary {
  const parsed = designSchema.safeParse(parseArtifactJson(bytes))
  if (!parsed.success) {
    return artifactError('Question-generation Design artifact is unsupported')
  }
  const design = parsed.data
  if (
    design.assessment.id !== expected.buildId ||
    design.assessment.target_questions !==
      expected.configuration.questionCount ||
    design.resolved_slots.length !== expected.configuration.questionCount ||
    design.origin_counts.new !== expected.configuration.questionCount
  ) {
    return artifactError(
      'Question-generation Design artifact does not match the build'
    )
  }

  const moduleIds = design.modules.map((module) => module.module_id)
  const objectiveIds = design.objectives.map(
    (objective) => objective.objective_id
  )
  const slotIds = design.resolved_slots.map((slot) => slot.design_slot_id)
  if (
    design.modules.length !== 1 ||
    design.modules[0]?.module_id !== 'M1' ||
    new Set(moduleIds).size !== moduleIds.length ||
    new Set(objectiveIds).size !== objectiveIds.length ||
    new Set(slotIds).size !== slotIds.length
  ) {
    return artifactError(
      'Question-generation Design identifiers are inconsistent'
    )
  }

  const objectives = new Map(
    design.objectives.map((objective) => [
      objective.objective_id,
      { moduleId: objective.module_id, text: objective.objective_text },
    ])
  )
  if (
    objectives.size !== expected.configuration.objectives.length ||
    expected.configuration.objectives.some(
      (objective) =>
        objectives.get(objective.id)?.moduleId !== 'M1' ||
        objectives.get(objective.id)?.text !== objective.text
    )
  ) {
    return artifactError('Question-generation Design objectives changed')
  }

  const configuredObjectiveIds = new Set(
    expected.configuration.objectives.map((objective) => objective.id)
  )
  const expectedItemFormat = workerItemFormat(
    configuredItemType(expected.configuration)
  )
  const actualDifficultyCounts = [0, 0, 0, 0, 0]
  for (const slot of design.resolved_slots) {
    const objectiveId = optionalText(slot.objective_id)
    const bloomLevel = slot.bloom_level === '' ? null : slot.bloom_level
    if (
      (slot.origin_mode ?? slot.allocated_origin_mode) !== 'new' ||
      slot.item_format !== expectedItemFormat ||
      slot.module_id !== 'M1' ||
      (objectiveId !== null && !configuredObjectiveIds.has(objectiveId)) ||
      !matchesConfiguredDesignBloom(
        expected.configuration,
        objectiveId,
        bloomLevel
      )
    ) {
      return artifactError(
        'Question-generation Design contains an unsupported slot'
      )
    }
    actualDifficultyCounts[slot.difficulty_scale - 1]! += 1
  }
  const configuredDifficultyCounts = Object.values(
    expected.configuration.difficultyCounts
  )
  if (
    actualDifficultyCounts.some(
      (count, index) => count !== configuredDifficultyCounts[index]
    )
  ) {
    return artifactError(
      'Question-generation Design difficulty allocation changed'
    )
  }

  const sourcesByFile = registeredSourcesByFile(expected.sourceSnapshot)
  const normalizedSources = design.sources.map((source) => {
    if (source.module_id !== 'M1') {
      return artifactError(
        'Question-generation Design source belongs to an unknown module'
      )
    }
    return normalizeReviewSource(
      source.source_file,
      source.page_from,
      source.page_to,
      sourcesByFile
    )
  })

  const selectedSourceIds = new Set(
    expected.configuration.sourceScopes.map((scope) => scope.resourceId)
  )
  const unrestricted =
    expected.configuration.sourceScopes.length ===
      expected.sourceSnapshot.length &&
    expected.configuration.sourceScopes.every(
      (scope) => scope.pageFrom === null && scope.pageTo === null
    ) &&
    expected.sourceSnapshot.every((source) =>
      selectedSourceIds.has(source.resourceId)
    )
  const expectedSources = unrestricted
    ? []
    : expected.configuration.sourceScopes.map((scope) => {
        const source = expected.sourceSnapshot.find(
          (candidate) => candidate.resourceId === scope.resourceId
        )
        if (!source) {
          return artifactError(
            'Question-generation configuration references an unknown graph source'
          )
        }
        const pageFrom = scope.pageFrom ?? 1
        const pageTo = scope.pageTo ?? source.pageCount
        if (pageTo === null) {
          return artifactError(
            'Question-generation source has no bounded registered page range'
          )
        }
        return normalizeReviewSource(
          source.sourceFile,
          pageFrom,
          pageTo,
          sourcesByFile
        )
      })
  if (JSON.stringify(normalizedSources) !== JSON.stringify(expectedSources)) {
    return artifactError('Question-generation Design sources changed')
  }

  const moduleQuestionCounts = new Map<string, number>()
  for (const slot of design.resolved_slots) {
    moduleQuestionCounts.set(
      slot.module_id,
      (moduleQuestionCounts.get(slot.module_id) ?? 0) + 1
    )
  }

  return {
    title: design.assessment.title,
    questionCount: design.assessment.target_questions,
    objectives: expected.configuration.objectives,
    modules: design.modules.map((module) => ({
      moduleId: module.module_id,
      moduleName: module.module_name,
      questionCount: moduleQuestionCounts.get(module.module_id) ?? 0,
    })),
    sources: normalizedSources,
    slots: design.resolved_slots.map((slot) => ({
      sourceQuestionId: slot.design_slot_id,
      moduleId: slot.module_id,
      objectiveId: optionalText(slot.objective_id),
      bloomLevel: slot.bloom_level === '' ? null : slot.bloom_level,
      targetDifficulty: slot.difficulty_scale,
    })),
    warnings: design.topic_overview.coverage_warnings.map((message) =>
      warning('PIPELINE_COVERAGE_WARNING', message)
    ),
  }
}

export function parseQuestionGenerationPlan(
  bytes: Buffer,
  expected: {
    buildId: string
    configuration: QuestionGenerationConfiguration
    sourceSnapshot: KBGraphSourceSnapshot
    v3Evidence?: {
      graphVersionId: string
      graphManifest: QuestionGenerationArtifactRef
      graphSha256: string
      startManifestSha256: string
    }
  }
): QuestionGenerationPlanSummary {
  const parsed = planSchema.safeParse(parseArtifactJson(bytes))
  if (!parsed.success) {
    return artifactError('Question-generation Plan artifact is unsupported')
  }
  const plan = parsed.data
  const provenance = plan.metadata.question_blueprint_workflow
  const expectedItemType = configuredItemType(expected.configuration)
  const expectedItemFormat = workerItemFormat(expectedItemType)
  const v3Evidence = expected.v3Evidence
  const currentContract = v3Evidence !== undefined
  if (
    provenance.question_build_id !== expected.buildId ||
    provenance.requested_questions !== expected.configuration.questionCount ||
    (provenance.schema_version === 3) !== currentContract ||
    !matchesWorkerArtifactFormat(
      plan.metadata.format,
      expectedItemType,
      currentContract
    ) ||
    (provenance.schema_version === 3 &&
      (plan.metadata.item_format !==
        workerMetadataItemFormat(expectedItemType) ||
        v3Evidence === undefined ||
        provenance.start_manifest_sha256 !== v3Evidence.startManifestSha256 ||
        provenance.frozen_graph_sha256 !== v3Evidence.graphSha256 ||
        !pinnedQuestionEvidenceMatches(
          provenance.pinned_question_evidence,
          v3Evidence
        ))) ||
    plan.questions.length !== expected.configuration.questionCount ||
    new Set(plan.questions.map((question) => question.id)).size !==
      plan.questions.length ||
    plan.questions.some(
      (question) => question.item_format !== expectedItemFormat
    )
  ) {
    return artifactError(
      'Question-generation Plan artifact does not match the build'
    )
  }

  const configuredObjectiveIds = new Set(
    expected.configuration.objectives.map((objective) => objective.id)
  )
  const sourcesByFile = registeredSourcesByFile(expected.sourceSnapshot)
  const normalizedQuestions = plan.questions.map((question) => {
    const objectiveId = optionalText(question.objective_id)
    if (
      question.module_id !== 'M1' ||
      (objectiveId !== null && !configuredObjectiveIds.has(objectiveId)) ||
      !matchesConfiguredBloom(
        expected.configuration,
        objectiveId,
        question.bloom_level
      )
    ) {
      return artifactError(
        'Question-generation Plan contains unsupported provenance'
      )
    }

    const evidenceIds = question.source_evidence.map(
      (evidence) => evidence.evidence_id
    )
    const supportingIds = question.supporting_evidence_ids
    if (
      new Set(evidenceIds).size !== evidenceIds.length ||
      new Set(supportingIds).size !== supportingIds.length ||
      supportingIds.some((evidenceId) => !evidenceIds.includes(evidenceId))
    ) {
      return artifactError(
        'Question-generation Plan evidence references are inconsistent'
      )
    }
    const supportingIdSet = new Set(supportingIds)
    const sources = question.source_evidence.flatMap((evidence) => {
      if (!supportingIdSet.has(evidence.evidence_id)) return []
      const page = evidence.page ?? null
      return [
        normalizeReviewSource(evidence.source_file, page, page, sourcesByFile),
      ]
    })

    return {
      sourceQuestionId: question.id,
      moduleId: question.module_id,
      objectiveId,
      stem: question.stem,
      bloomLevel: question.bloom_level,
      targetDifficulty: question.difficulty_scale,
      sources,
    }
  })

  const warnings = plan.questions.flatMap((question) => {
    const result: QuestionGenerationWarning[] = []
    if (question.manual_review_required) {
      result.push(
        warning(
          'PIPELINE_MANUAL_REVIEW',
          `${question.id} requires manual review.`
        )
      )
    }
    for (const issue of question.verification_issues ?? []) {
      result.push(warning('PIPELINE_VERIFICATION_WARNING', issue))
    }
    return result
  })
  if (warnings.length > MAX_WARNING_COUNT) {
    return artifactError('Question-generation Plan contains too many warnings')
  }

  return {
    questionCount: plan.questions.length,
    questions: normalizedQuestions,
    warnings,
  }
}

export function parseQuestionGenerationResult(
  bytes: Buffer,
  expected: {
    buildId: string
    questionCount: number
    requiresCompleteProvenance?: boolean
  }
): QuestionGenerationResultManifest {
  const raw = parseArtifactJson(bytes)
  const parsed = resultSchema.safeParse(raw)
  if (!parsed.success) {
    return artifactError('Question-generation result artifact is unsupported')
  }
  const result = parsed.data
  const hasField = (field: string) =>
    typeof raw === 'object' && raw !== null && Object.hasOwn(raw, field)
  const requestedPresent = hasField('requested_questions')
  const reviewCountPresent = hasField('review_required_questions')
  const reviewIdsPresent = hasField('review_required_question_ids')
  const legacyCompleted =
    result.status === 'completed' &&
    !requestedPresent &&
    !reviewCountPresent &&
    !reviewIdsPresent
  const currentSuccessMetadata =
    requestedPresent && reviewCountPresent && reviewIdsPresent
  const reviewRequiredQuestions = result.review_required_questions ?? 0
  const reviewRequiredQuestionIds = result.review_required_question_ids ?? []
  const questionProvenanceIndex = result.question_provenance_index ?? null
  if (result.question_build_id !== expected.buildId) {
    return artifactError('Question-generation result belongs to another build')
  }
  if (
    result.status === 'completed' ||
    result.status === 'completed_with_review'
  ) {
    if (
      (!legacyCompleted && !currentSuccessMetadata) ||
      (!legacyCompleted &&
        result.requested_questions !== expected.questionCount) ||
      result.generated_questions !== expected.questionCount ||
      result.final_questions === null ||
      (expected.requiresCompleteProvenance === true &&
        (result.schema_version !== 2 || questionProvenanceIndex === null)) ||
      (result.schema_version === 2 && questionProvenanceIndex === null) ||
      (result.schema_version === 1 && questionProvenanceIndex !== null) ||
      result.rejected_at !== null ||
      result.reviewed_by !== null ||
      new Set(reviewRequiredQuestionIds).size !==
        reviewRequiredQuestionIds.length ||
      reviewRequiredQuestions !== reviewRequiredQuestionIds.length ||
      reviewRequiredQuestions > result.generated_questions ||
      (result.status === 'completed' && reviewRequiredQuestions !== 0) ||
      (result.status === 'completed_with_review' &&
        reviewRequiredQuestions === 0)
    ) {
      return artifactError(
        'Completed question-generation result is inconsistent'
      )
    }
  } else if (result.status === 'rejected') {
    if (
      result.final_questions !== null ||
      questionProvenanceIndex !== null ||
      result.rejected_at === null ||
      result.reviewed_by === null ||
      reviewRequiredQuestions !== 0 ||
      reviewRequiredQuestionIds.length !== 0
    ) {
      return artifactError(
        'Rejected question-generation result is inconsistent'
      )
    }
  } else if (
    result.final_questions !== null ||
    questionProvenanceIndex !== null ||
    result.rejected_at !== null ||
    result.reviewed_by !== null ||
    reviewRequiredQuestions !== 0 ||
    reviewRequiredQuestionIds.length !== 0
  ) {
    return artifactError('Failed question-generation result is inconsistent')
  }

  return {
    schemaVersion: result.schema_version,
    status: result.status,
    requestedQuestions: result.requested_questions ?? null,
    generatedQuestions: result.generated_questions,
    finalQuestions: result.final_questions
      ? toArtifactRef(result.final_questions)
      : null,
    questionProvenanceIndex: questionProvenanceIndex
      ? toArtifactRef(questionProvenanceIndex)
      : null,
    reviewRequiredQuestions,
    reviewRequiredQuestionIds,
    legacyCompleted,
    rejectedAt: result.rejected_at,
    reviewedBy: result.reviewed_by,
  }
}

export function parseQuestionGenerationFinalBank(
  bytes: Buffer,
  expected: {
    itemType?: QuestionGenerationItemType
    questionCount: number
    sourceSnapshot: KBGraphSourceSnapshot
    expectedQuestionIds: string[]
    result: QuestionGenerationResultManifest
    lineage?: QuestionGenerationGraphLineage | null
    provenanceAuthority?: QuestionGenerationProvenanceAuthority | null
  }
): GeneratedQuestionWithProvenance[] {
  const parsed = finalBankSchema.safeParse(parseArtifactJson(bytes))
  if (!parsed.success) {
    return artifactError('Final question bank is unsupported')
  }
  const bank = parsed.data
  const expectedItemType = expected.itemType ?? 'SC'
  if (
    (expected.result.schemaVersion === 2 &&
      (!expected.lineage ||
        !expected.provenanceAuthority ||
        bank.metadata.item_format !==
          workerMetadataItemFormat(expectedItemType))) ||
    !matchesWorkerArtifactFormat(
      bank.metadata.format,
      expectedItemType,
      expected.result.schemaVersion === 2
    ) ||
    bank.metadata.total_questions !== expected.questionCount ||
    bank.questions.length !== expected.questionCount ||
    new Set(bank.questions.map((question) => question.id)).size !==
      bank.questions.length ||
    new Set(expected.expectedQuestionIds).size !==
      expected.expectedQuestionIds.length ||
    expected.expectedQuestionIds.length !== expected.questionCount ||
    bank.questions.some(
      (question) => !expected.expectedQuestionIds.includes(question.id)
    )
  ) {
    return artifactError('Final question bank does not match the build')
  }

  const reviewRequiredQuestionIds = bank.questions.flatMap((question) => {
    if (question.difficulty_status === undefined) {
      if (!expected.result.legacyCompleted) {
        return artifactError(
          'Final question bank has no current difficulty status'
        )
      }
      return []
    }
    return question.difficulty_status === 'llm_reviewed' ? [] : [question.id]
  })
  if (
    !expected.result.legacyCompleted &&
    (expected.result.reviewRequiredQuestions !==
      reviewRequiredQuestionIds.length ||
      expected.result.reviewRequiredQuestionIds.some(
        (questionId, index) => questionId !== reviewRequiredQuestionIds[index]
      ))
  ) {
    return artifactError(
      'Final question bank difficulty review does not match the result'
    )
  }

  return bank.questions.map((question) =>
    normalizeFinalQuestion(
      question,
      expectedItemType,
      expected.sourceSnapshot,
      expected.lineage ?? null,
      expected.provenanceAuthority ?? null
    )
  )
}

function addIndexedQuestion(
  mapping: Record<string, Set<string>>,
  key: string,
  questionId: string
) {
  if (!mapping[key]) mapping[key] = new Set()
  mapping[key].add(questionId)
}

function finalizedIndexMapping(
  mapping: Record<string, Set<string>>
): Record<string, string[]> {
  return Object.fromEntries(
    Object.keys(mapping)
      .sort()
      .map((key) => [key, [...mapping[key]!].sort()])
  )
}

export function parseQuestionGenerationProvenanceIndex(
  bytes: Buffer,
  questions: GeneratedQuestionWithProvenance[]
): QuestionGenerationProvenanceIndex {
  const parsed = provenanceIndexSchema.safeParse(parseArtifactJson(bytes))
  if (!parsed.success) {
    return artifactError('Question provenance index is unsupported')
  }
  const questionIds = questions.map((question) => question.sourceQuestionId)
  const byNodeId: Record<string, Set<string>> = {}
  const byRelationshipId: Record<string, Set<string>> = {}
  const byAssertionId: Record<string, Set<string>> = {}
  const bySourceRef: Record<string, Set<string>> = {}
  for (const question of questions) {
    if (!question.provenance) continue
    for (const nodeId of question.provenance.nodeIds) {
      addIndexedQuestion(byNodeId, nodeId, question.sourceQuestionId)
    }
    for (const relationshipId of question.provenance.relationshipIds) {
      addIndexedQuestion(
        byRelationshipId,
        relationshipId,
        question.sourceQuestionId
      )
    }
    for (const citation of question.provenance.assertionCitations) {
      addIndexedQuestion(
        byAssertionId,
        citation.assertionId,
        question.sourceQuestionId
      )
    }
    for (const citation of question.provenance.sourceCitations) {
      for (const chunkId of citation.chunkIds) {
        addIndexedQuestion(
          bySourceRef,
          `chunk:${chunkId}`,
          question.sourceQuestionId
        )
      }
      for (const sourcePage of citation.sourcePages) {
        addIndexedQuestion(
          bySourceRef,
          `page:${sourcePage}`,
          question.sourceQuestionId
        )
      }
      for (const marker of citation.lectureMarkers) {
        addIndexedQuestion(
          bySourceRef,
          `lecture:${marker}`,
          question.sourceQuestionId
        )
      }
    }
  }
  const expected = {
    schema_version: 1,
    question_ids: [...questionIds].sort(),
    by_node_id: finalizedIndexMapping(byNodeId),
    by_relationship_id: finalizedIndexMapping(byRelationshipId),
    by_assertion_id: finalizedIndexMapping(byAssertionId),
    by_source_ref: finalizedIndexMapping(bySourceRef),
  }
  if (JSON.stringify(parsed.data) !== JSON.stringify(expected)) {
    return artifactError(
      'Question provenance index does not match the final question bank'
    )
  }
  return {
    schemaVersion: 1,
    questionIds: expected.question_ids,
    byNodeId: expected.by_node_id,
    byRelationshipId: expected.by_relationship_id,
    byAssertionId: expected.by_assertion_id,
    bySourceRef: expected.by_source_ref,
  }
}
