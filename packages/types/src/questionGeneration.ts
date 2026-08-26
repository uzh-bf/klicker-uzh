export type QuestionGenerationArtifactRef = {
  containerName: string
  blobName: string
  sha256: string
}

export type KBGraphSourceSnapshotItem = {
  resourceId: string
  title: string
  sourceFile: string
  contentSha256: string
  resourceVersion: number
  pageCount: number | null
}

export type KBGraphSourceSnapshot = KBGraphSourceSnapshotItem[]

export type QuestionGenerationLanguage = 'de' | 'en'
export type QuestionGenerationItemType = 'SC' | 'MC' | 'KPRIM'
export type QuestionGenerationBloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
export type QuestionGenerationDifficultyPreset = 'EASY' | 'MIXED' | 'HARD'
export type QuestionGenerationDifficultyCounts = {
  d1: number
  d2: number
  d3: number
  d4: number
  d5: number
}

const QUESTION_GENERATION_DIFFICULTY_KEYS = [
  'd1',
  'd2',
  'd3',
  'd4',
  'd5',
] as const
const QUESTION_GENERATION_DIFFICULTY_WEIGHTS = {
  EASY: [40, 40, 20, 0, 0],
  MIXED: [10, 25, 30, 25, 10],
  HARD: [0, 0, 20, 40, 40],
} as const satisfies Record<
  QuestionGenerationDifficultyPreset,
  readonly [number, number, number, number, number]
>

export function allocateQuestionGenerationDifficulty(
  count: number,
  preset: QuestionGenerationDifficultyPreset
): QuestionGenerationDifficultyCounts {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('Question count must be an integer from 1 to 20')
  }

  const shares = QUESTION_GENERATION_DIFFICULTY_WEIGHTS[preset].map(
    (weight, index) => {
      const raw = (count * weight) / 100
      const base = Math.floor(raw)
      return { index, base, remainder: raw - base }
    }
  )
  let remaining = count - shares.reduce((sum, share) => sum + share.base, 0)

  for (const share of [...shares].sort(
    (left, right) =>
      right.remainder - left.remainder || left.index - right.index
  )) {
    if (remaining === 0) break
    share.base += 1
    remaining -= 1
  }

  return Object.fromEntries(
    shares.map((share, index) => [
      QUESTION_GENERATION_DIFFICULTY_KEYS[index],
      share.base,
    ])
  ) as QuestionGenerationDifficultyCounts
}

export type QuestionGenerationConfiguration = {
  itemType: QuestionGenerationItemType
  language: QuestionGenerationLanguage
  questionCount: number
  difficultyPreset: QuestionGenerationDifficultyPreset
  difficultyCounts: QuestionGenerationDifficultyCounts
  sourceScopes: Array<{
    resourceId: string
    pageFrom: number | null
    pageTo: number | null
  }>
  objectives: Array<{
    id: string
    text: string
    bloomLevel: QuestionGenerationBloomLevel | null
  }>
  bloomLevels: QuestionGenerationBloomLevel[]
}

export type GeneratedQuestionCitation = {
  resourceId: string
  sourceFile: string
  pageFrom: number | null
  pageTo: number | null
  chunkIds: string[]
}

export type QuestionGenerationSourceProvenanceCitation = {
  elementType: 'node' | 'relationship'
  elementId: string
  chunkIds: string[]
  sourcePages: string[]
  lectureMarkers: string[]
}

export type QuestionGenerationAssertionProvenanceCitation = {
  assertionId: string
  version: number
}

export type QuestionGenerationQuestionProvenance = {
  schemaVersion: 1
  lineageStatus: 'complete' | 'legacy_incomplete'
  graphVersionId: string | null
  bundleSha256: string | null
  graphSha256: string | null
  domainPolicyDigest: string | null
  generationRecipeDigest: string | null
  nodeIds: string[]
  relationshipIds: string[]
  sourceCitations: QuestionGenerationSourceProvenanceCitation[]
  assertionCitations: QuestionGenerationAssertionProvenanceCitation[]
}

export type QuestionGenerationProvenanceIndex = {
  schemaVersion: 1
  questionIds: string[]
  byNodeId: Record<string, string[]>
  byRelationshipId: Record<string, string[]>
  byAssertionId: Record<string, string[]>
  bySourceRef: Record<string, string[]>
}

export type GeneratedQuestionEditable = {
  itemType: QuestionGenerationItemType
  name: string
  stem: string
  context: string | null
  explanation: string | null
  choices: Array<{
    id: string
    label: string
    text: string
    correct: boolean
    feedback: string | null
  }>
}

export type GeneratedQuestionOriginal = GeneratedQuestionEditable & {
  sourceQuestionId: string
  bloomLevel: QuestionGenerationBloomLevel
  targetDifficulty: number
  predictedDifficulty: number | null
  qualityFlags: string[]
  citations: GeneratedQuestionCitation[]
}

export type GeneratedQuestionWithProvenance = GeneratedQuestionOriginal & {
  provenance: QuestionGenerationQuestionProvenance | null
}

export type QuestionGenerationWarning = {
  code: string
  message: string
}

export type QuestionGenerationReviewSourceSummary = {
  sourceFile: string
  pageFrom: number | null
  pageTo: number | null
}

export type QuestionGenerationDesignModuleSummary = {
  moduleId: string
  moduleName: string
  questionCount: number
}

export type QuestionGenerationDesignSlotSummary = {
  sourceQuestionId: string
  moduleId: string
  objectiveId: string | null
  bloomLevel: QuestionGenerationBloomLevel | null
  targetDifficulty: number
}

export type QuestionGenerationDesignSummary = {
  title: string
  questionCount: number
  objectives: Array<{
    id: string
    text: string
    bloomLevel: QuestionGenerationBloomLevel | null
  }>
  modules: QuestionGenerationDesignModuleSummary[]
  sources: QuestionGenerationReviewSourceSummary[]
  slots: QuestionGenerationDesignSlotSummary[]
  warnings: QuestionGenerationWarning[]
}

export type QuestionGenerationPlanSummary = {
  questionCount: number
  questions: Array<{
    sourceQuestionId: string
    moduleId: string
    objectiveId: string | null
    stem: string
    bloomLevel: QuestionGenerationBloomLevel
    targetDifficulty: number
    sources: QuestionGenerationReviewSourceSummary[]
  }>
  warnings: QuestionGenerationWarning[]
}

export const QUESTION_GENERATION_CAPABILITIES = {
  itemTypes: ['SC', 'MC', 'KPRIM'],
  languages: ['de', 'en'],
  bloomLevels: ['remember', 'understand', 'apply', 'analyze', 'evaluate'],
  difficultyLevels: [1, 2, 3, 4, 5],
  requiresDesignReview: true,
  requiresPlanReview: true,
  supportsIndividualRegeneration: false,
} as const
