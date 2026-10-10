import type {
  GeneratedFlashcard,
  QuestionGenerationArtifactRef,
} from '@klicker-uzh/types'
import { z } from 'zod'
import { questionGenerationServiceError } from './questionGenerationErrors.js'

const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024
const MAX_TEXT_LENGTH = 20_000
const MAX_IDENTIFIER_LENGTH = 200
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const AZURE_CONTAINER_PATTERN = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/

const canonicalText = (maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value === value.trim() && !/\p{C}/u.test(value))

const canonicalOptionalText = (maxLength: number) =>
  z
    .string()
    .max(maxLength)
    .refine((value) => value === value.trim() && !/\p{C}/u.test(value))

const canonicalContent = (maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine(
      (value) =>
        value === value.trim() &&
        !Array.from(value).some(
          (character) =>
            character !== '\n' &&
            character !== '\r' &&
            character !== '\t' &&
            /\p{C}/u.test(character)
        )
    )

const relativeBlobPath = canonicalText(1024).refine((value) => {
  const segments = value.split('/')
  return (
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !value.includes('?') &&
    !value.includes('#') &&
    segments.every((segment) => segment && segment !== '.' && segment !== '..')
  )
}, 'Blob path must be canonical')

const artifactRefSchema = z
  .object({
    container_name: z.string().regex(AZURE_CONTAINER_PATTERN),
    blob_name: relativeBlobPath,
    sha256: z.string().regex(SHA256_PATTERN),
  })
  .strict()

function containsObjectKey(value: unknown, rejectedKey: string): boolean {
  const pending = [value]
  while (pending.length > 0) {
    const current = pending.pop()
    if (Array.isArray(current)) {
      pending.push(...current)
    } else if (current !== null && typeof current === 'object') {
      for (const [key, child] of Object.entries(current)) {
        if (key === rejectedKey) return true
        pending.push(child)
      }
    }
  }
  return false
}

const publicBlueprintSchema = z
  .object({ artifact: artifactRefSchema })
  .passthrough()
  .refine(
    (value) => !containsObjectKey(value, 'path'),
    'Blueprint contains a worker path'
  )

const publicGraphSchema = z
  .object({
    version_id: canonicalText(MAX_IDENTIFIER_LENGTH),
    manifest: artifactRefSchema,
  })
  .passthrough()
  .refine(
    (value) => !containsObjectKey(value, 'path'),
    'Graph contains a worker path'
  )

const completePublicationSchema = z
  .object({
    status: z.literal('complete'),
    requested_flashcard_count: z.number().int().positive(),
    accepted_flashcard_count: z.number().int().positive(),
    unresolved_flashcard_count: z.literal(0),
    resumable: z.literal(false),
  })
  .passthrough()
  .refine(
    (value) => !('checkpoint_path' in value),
    'Publication contains a worker checkpoint path'
  )

const incompletePublicationSchema = z
  .object({
    status: z.literal('incomplete'),
    requested_flashcard_count: z.number().int().positive(),
    accepted_flashcard_count: z.number().int().nonnegative(),
    unresolved_flashcard_count: z.number().int().positive(),
    resumable: z.literal(true),
    checkpoint_snapshot: artifactRefSchema,
  })
  .passthrough()
  .refine(
    (value) => !('checkpoint_path' in value),
    'Publication contains a worker checkpoint path'
  )

const flashcardSchema = z
  .object({
    id: canonicalText(MAX_IDENTIFIER_LENGTH),
    front: canonicalContent(MAX_TEXT_LENGTH),
    back: canonicalContent(MAX_TEXT_LENGTH),
    card_type: z.enum(['definition', 'formula', 'calculation']),
    module: z
      .object({
        module_id: canonicalText(MAX_IDENTIFIER_LENGTH),
        module_name: canonicalOptionalText(500),
      })
      .passthrough(),
    lernziel: z
      .object({
        objective_id: canonicalOptionalText(MAX_IDENTIFIER_LENGTH),
        objective_text: canonicalOptionalText(500),
      })
      .passthrough(),
  })
  .passthrough()

const unresolvedFlashcardSlotSchema = z
  .object({
    id: canonicalText(MAX_IDENTIFIER_LENGTH),
    module: z
      .object({
        module_id: canonicalText(MAX_IDENTIFIER_LENGTH),
        module_name: canonicalOptionalText(500),
      })
      .passthrough(),
    lernziel: z
      .object({
        objective_id: canonicalOptionalText(MAX_IDENTIFIER_LENGTH),
        objective_text: canonicalOptionalText(500),
        objective_source: canonicalText(MAX_IDENTIFIER_LENGTH),
      })
      .passthrough(),
    status: z.literal('rejected'),
    rejection: z
      .object({
        stage: z.enum([
          'citation_grounding',
          'pedagogical_quality',
          'calculation_validation',
          'format_validation',
          'deferred_after_related_failure',
          'generation',
        ]),
        reviewer_note: canonicalContent(MAX_TEXT_LENGTH),
        failed_at: z.string().nullable(),
        attempts_exhausted: z.boolean(),
      })
      .passthrough(),
  })
  .passthrough()

const flashcardBankBaseSchema = z.object({
  format: z.literal('flashcard-bank-v1'),
  schema_version: z.literal(1),
  requested_flashcard_count: z.number().int().positive(),
  accepted_flashcard_count: z.number().int().nonnegative(),
  unresolved_flashcard_count: z.number().int().nonnegative(),
  metadata: z
    .object({
      blueprint: publicBlueprintSchema,
      graph: publicGraphSchema,
    })
    .passthrough(),
  flashcards: z.array(flashcardSchema).max(500),
  unresolved_slots: z.array(unresolvedFlashcardSlotSchema).max(500),
})

const flashcardBankSchema = flashcardBankBaseSchema
  .extend({
    status: z.literal('complete'),
    accepted_flashcard_count: z.number().int().positive(),
    unresolved_flashcard_count: z.literal(0),
    metadata: flashcardBankBaseSchema.shape.metadata.extend({
      publication: completePublicationSchema,
    }),
    flashcards: z.array(flashcardSchema).min(1).max(500),
    unresolved_slots: z.array(z.never()).length(0),
  })
  .passthrough()

const incompleteFlashcardBankSchema = flashcardBankBaseSchema
  .extend({
    status: z.literal('incomplete'),
    unresolved_flashcard_count: z.number().int().positive(),
    metadata: flashcardBankBaseSchema.shape.metadata.extend({
      publication: incompletePublicationSchema,
    }),
  })
  .passthrough()

const flashcardResultSchema = z
  .object({
    schema_version: z.literal(1),
    flashcard_build_id: canonicalText(MAX_IDENTIFIER_LENGTH),
    graph_version_id: canonicalText(MAX_IDENTIFIER_LENGTH),
    graph_manifest: artifactRefSchema,
    blueprint: artifactRefSchema,
    status: z.enum(['completed', 'completed_with_review', 'incomplete']),
    requested_flashcards: z.number().int().positive(),
    accepted_flashcards: z.number().int().nonnegative(),
    unresolved_flashcards: z.number().int().nonnegative(),
    warning_count: z.number().int().nonnegative(),
    flashcard_bank: artifactRefSchema,
    checkpoint_snapshot: artifactRefSchema.nullable(),
    reviewed_by: canonicalText(500).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.accepted_flashcards + value.unresolved_flashcards !==
      value.requested_flashcards
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Flashcard result counts are inconsistent',
      })
    }
    if (
      value.status === 'completed' &&
      (value.unresolved_flashcards !== 0 ||
        value.warning_count !== 0 ||
        value.checkpoint_snapshot !== null ||
        value.reviewed_by !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Completed flashcard result fields are inconsistent',
      })
    }
    if (
      value.status === 'completed_with_review' &&
      (value.unresolved_flashcards !== 0 ||
        value.warning_count === 0 ||
        value.checkpoint_snapshot !== null ||
        value.reviewed_by !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Reviewed flashcard result fields are inconsistent',
      })
    }
    if (
      value.status === 'incomplete' &&
      (value.unresolved_flashcards === 0 ||
        value.checkpoint_snapshot === null ||
        value.reviewed_by === null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Incomplete flashcard result fields are inconsistent',
      })
    }
  })

function artifactError(message: string): never {
  throw questionGenerationServiceError('ARTIFACT_INVALID', message)
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

function artifactRef(
  value: z.infer<typeof artifactRefSchema>
): QuestionGenerationArtifactRef {
  return {
    containerName: value.container_name,
    blobName: value.blob_name,
    sha256: value.sha256,
  }
}

function parseJson(bytes: Buffer, label: string): unknown {
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
    return artifactError(`${label} exceeds the artifact size limit`)
  }
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch {
    return artifactError(`${label} is not valid JSON`)
  }
}

function generatedFlashcards(
  cards: Array<z.infer<typeof flashcardSchema>>
): GeneratedFlashcard[] {
  const ids = cards.map((card) => card.id)
  if (new Set(ids).size !== ids.length) {
    return artifactError('Flashcard bank IDs must be unique')
  }

  return cards.map((card) => {
    const moduleId = card.module.module_id
    const objectiveId = card.lernziel.objective_id
    return {
      sourceFlashcardId: card.id,
      name: [moduleId, objectiveId, card.id].filter(Boolean).join(' · '),
      front: card.front,
      back: card.back,
      cardType: card.card_type,
      tags: [
        'generated-flashcard',
        `flashcard:${card.card_type}`,
        moduleId,
        objectiveId,
      ].filter(
        (value, index, values) => value && values.indexOf(value) === index
      ),
    }
  })
}

function verifyBankLineage(
  bank: z.infer<typeof flashcardBankBaseSchema>,
  expected: {
    graphVersionId: string
    graphManifest: QuestionGenerationArtifactRef
    blueprint: QuestionGenerationArtifactRef
  }
) {
  if (bank.metadata.graph.version_id !== expected.graphVersionId) {
    return artifactError(
      'Flashcard bank graph version does not match the requested build'
    )
  }
  if (
    !artifactRefMatches(bank.metadata.graph.manifest, expected.graphManifest)
  ) {
    return artifactError(
      'Flashcard bank graph manifest does not match the requested build'
    )
  }
  if (
    !artifactRefMatches(bank.metadata.blueprint.artifact, expected.blueprint)
  ) {
    return artifactError(
      'Flashcard bank blueprint does not match the requested build'
    )
  }
}

export function parseFlashcardGenerationResult(
  bytes: Buffer,
  expected: {
    buildId: string
    graphVersionId: string
    graphManifest: QuestionGenerationArtifactRef
    blueprint: QuestionGenerationArtifactRef
    requestedFlashcardCount: number
    outputContainer: string
    outputPrefix: string
  }
) {
  const parsed = flashcardResultSchema.safeParse(
    parseJson(bytes, 'Flashcard result manifest')
  )
  if (!parsed.success) {
    return artifactError('Flashcard result manifest is invalid')
  }
  const result = parsed.data
  if (
    result.flashcard_build_id !== expected.buildId ||
    result.graph_version_id !== expected.graphVersionId ||
    result.requested_flashcards !== expected.requestedFlashcardCount ||
    !artifactRefMatches(result.graph_manifest, expected.graphManifest) ||
    !artifactRefMatches(result.blueprint, expected.blueprint)
  ) {
    return artifactError('Flashcard result does not match the requested build')
  }
  if (
    result.flashcard_bank.container_name !== expected.outputContainer ||
    result.flashcard_bank.blob_name !==
      `${expected.outputPrefix}/${expected.buildId}/flashcards/bank.json` ||
    (result.checkpoint_snapshot !== null &&
      (result.checkpoint_snapshot.container_name !== expected.outputContainer ||
        result.checkpoint_snapshot.blob_name !==
          `${expected.outputPrefix}/${expected.buildId}/checkpoints/published.json`))
  ) {
    return artifactError('Flashcard result artifact coordinates are invalid')
  }

  return {
    status: result.status,
    requestedFlashcards: result.requested_flashcards,
    acceptedFlashcards: result.accepted_flashcards,
    unresolvedFlashcards: result.unresolved_flashcards,
    warningCount: result.warning_count,
    flashcardBank: artifactRef(result.flashcard_bank),
    checkpointSnapshot:
      result.checkpoint_snapshot === null
        ? null
        : artifactRef(result.checkpoint_snapshot),
    reviewedBy: result.reviewed_by,
  }
}

export function parseTerminalFlashcardGenerationBank(
  bytes: Buffer,
  expected: {
    graphVersionId: string
    graphManifest: QuestionGenerationArtifactRef
    blueprint: QuestionGenerationArtifactRef
    requestedFlashcardCount: number
    acceptedFlashcardCount: number
    unresolvedFlashcardCount: number
    publicationStatus: 'complete' | 'incomplete'
    checkpointSnapshot: QuestionGenerationArtifactRef | null
  }
): { status: 'complete' | 'incomplete'; cards: GeneratedFlashcard[] } {
  const raw = parseJson(bytes, 'Flashcard bank')
  const parsed =
    expected.publicationStatus === 'complete'
      ? flashcardBankSchema.safeParse(raw)
      : incompleteFlashcardBankSchema.safeParse(raw)
  if (!parsed.success) {
    return artifactError(
      'Flashcard bank does not match the terminal publication contract'
    )
  }
  const bank = parsed.data
  if (
    bank.requested_flashcard_count !== expected.requestedFlashcardCount ||
    bank.accepted_flashcard_count !== expected.acceptedFlashcardCount ||
    bank.unresolved_flashcard_count !== expected.unresolvedFlashcardCount ||
    bank.metadata.publication.requested_flashcard_count !==
      expected.requestedFlashcardCount ||
    bank.metadata.publication.accepted_flashcard_count !==
      expected.acceptedFlashcardCount ||
    bank.metadata.publication.unresolved_flashcard_count !==
      expected.unresolvedFlashcardCount ||
    bank.flashcards.length !== expected.acceptedFlashcardCount ||
    bank.unresolved_slots.length !== expected.unresolvedFlashcardCount
  ) {
    return artifactError('Flashcard bank count fields are inconsistent')
  }
  verifyBankLineage(bank, expected)
  const publicationCheckpoint =
    bank.status === 'incomplete'
      ? artifactRef(bank.metadata.publication.checkpoint_snapshot)
      : null
  if (
    (publicationCheckpoint === null) !==
      (expected.checkpointSnapshot === null) ||
    (publicationCheckpoint !== null &&
      expected.checkpointSnapshot !== null &&
      (publicationCheckpoint.containerName !==
        expected.checkpointSnapshot.containerName ||
        publicationCheckpoint.blobName !==
          expected.checkpointSnapshot.blobName ||
        publicationCheckpoint.sha256 !== expected.checkpointSnapshot.sha256))
  ) {
    return artifactError('Flashcard bank checkpoint lineage is inconsistent')
  }
  return { status: bank.status, cards: generatedFlashcards(bank.flashcards) }
}

export function parseFlashcardGenerationBank(
  bytes: Buffer,
  expected: {
    graphVersionId: string
    graphManifest: QuestionGenerationArtifactRef
    blueprint: QuestionGenerationArtifactRef
    requestedFlashcardCount: number
  }
): GeneratedFlashcard[] {
  const raw = parseJson(bytes, 'Flashcard bank')

  const parsed = flashcardBankSchema.safeParse(raw)
  if (!parsed.success) {
    return artifactError(
      'Flashcard bank must be a complete flashcard-bank-v1 artifact'
    )
  }
  const bank = parsed.data
  const counts = [
    bank.requested_flashcard_count,
    bank.accepted_flashcard_count,
    bank.metadata.publication.requested_flashcard_count,
    bank.metadata.publication.accepted_flashcard_count,
    bank.flashcards.length,
  ]
  if (counts.some((count) => count !== expected.requestedFlashcardCount)) {
    return artifactError('Flashcard bank count fields are inconsistent')
  }
  verifyBankLineage(bank, expected)
  return generatedFlashcards(bank.flashcards)
}
