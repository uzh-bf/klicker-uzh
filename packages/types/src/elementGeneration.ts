export type ElementGenerationArtifactRef = {
  containerName: string
  blobName: string
  sha256: string
}

export type GeneratedElementType = 'SC' | 'MC' | 'KPRIM' | 'FLASHCARD'
export type GeneratedAssessmentElementType = Exclude<
  GeneratedElementType,
  'FLASHCARD'
>
export type ElementGenerationLanguage = 'de' | 'en'
export type ElementGenerationBloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
export type ElementGenerationDifficultyPreset =
  | 'D1'
  | 'D2'
  | 'D3'
  | 'D4'
  | 'D5'
  | 'EASY'
  | 'MIXED'
  | 'HARD'
export type ElementGenerationDifficultyCounts = {
  d1: number
  d2: number
  d3: number
  d4: number
  d5: number
}

const ELEMENT_GENERATION_DIFFICULTY_KEYS = [
  'd1',
  'd2',
  'd3',
  'd4',
  'd5',
] as const
const ELEMENT_GENERATION_DIFFICULTY_WEIGHTS = {
  D1: [100, 0, 0, 0, 0],
  D2: [0, 100, 0, 0, 0],
  D3: [0, 0, 100, 0, 0],
  D4: [0, 0, 0, 100, 0],
  D5: [0, 0, 0, 0, 100],
  EASY: [40, 40, 20, 0, 0],
  MIXED: [10, 25, 30, 25, 10],
  HARD: [0, 0, 20, 40, 40],
} as const satisfies Record<
  ElementGenerationDifficultyPreset,
  readonly [number, number, number, number, number]
>

export function allocateElementGenerationDifficulty(
  count: number,
  preset: ElementGenerationDifficultyPreset
): ElementGenerationDifficultyCounts {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('Element count must be an integer from 1 to 20')
  }

  const shares = ELEMENT_GENERATION_DIFFICULTY_WEIGHTS[preset].map(
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
      ELEMENT_GENERATION_DIFFICULTY_KEYS[index],
      share.base,
    ])
  ) as ElementGenerationDifficultyCounts
}

export type ElementGenerationSourceScope = {
  resourceId: string
  pageFrom: number | null
  pageTo: number | null
}

export type ElementGenerationObjective = {
  id: string
  text: string
  bloomLevel: ElementGenerationBloomLevel | null
}

export type AssessmentElementGenerationConfiguration = {
  elementType: GeneratedAssessmentElementType
  language: ElementGenerationLanguage
  elementCount: number
  difficultyPreset: ElementGenerationDifficultyPreset
  difficultyCounts: ElementGenerationDifficultyCounts
  sourceScopes: ElementGenerationSourceScope[]
  objectives: ElementGenerationObjective[]
  bloomLevels: ElementGenerationBloomLevel[]
}

export type FlashcardElementGenerationConfiguration = {
  elementType: 'FLASHCARD'
  language: ElementGenerationLanguage
  elementCount: number
  sourceScopes: ElementGenerationSourceScope[]
  objectives: Array<Omit<ElementGenerationObjective, 'bloomLevel'>>
}

export type ElementGenerationConfiguration =
  | AssessmentElementGenerationConfiguration
  | FlashcardElementGenerationConfiguration

export type ElementGenerationCitation = {
  resourceId: string
  sourceFile: string
  pageFrom: number | null
  pageTo: number | null
  chunkIds: string[]
}

export type ElementGenerationSourceProvenanceCitation = {
  elementType: 'node' | 'relationship'
  elementId: string
  chunkIds: string[]
  sourcePages: string[]
  lectureMarkers: string[]
}

export type ElementGenerationAssertionProvenanceCitation = {
  assertionId: string
  version: number
}

export type ElementGenerationProvenance = {
  schemaVersion: 1
  lineageStatus: 'complete' | 'legacy_incomplete'
  graphBuildId: string | null
  bundleSha256: string | null
  graphSha256: string | null
  domainPolicyDigest: string | null
  generationRecipeDigest: string | null
  nodeIds: string[]
  relationshipIds: string[]
  sourceCitations: ElementGenerationSourceProvenanceCitation[]
  assertionCitations: ElementGenerationAssertionProvenanceCitation[]
}

export type ElementGenerationProvenanceIndex = {
  schemaVersion: 1
  elementIds: string[]
  byNodeId: Record<string, string[]>
  byRelationshipId: Record<string, string[]>
  byAssertionId: Record<string, string[]>
  bySourceRef: Record<string, string[]>
}

export type GeneratedChoiceElementEditable = {
  elementType: GeneratedAssessmentElementType
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

export type GeneratedFlashcardType = 'definition' | 'formula' | 'calculation'

export type GeneratedFlashcardElementEditable = {
  elementType: 'FLASHCARD'
  name: string
  front: string
  back: string
  cardType: GeneratedFlashcardType
  tags: string[]
}

export type GeneratedElementEditable =
  | GeneratedChoiceElementEditable
  | GeneratedFlashcardElementEditable

export type GeneratedElementOriginal = GeneratedElementEditable & {
  sourceElementId: string
  bloomLevel: ElementGenerationBloomLevel | null
  targetDifficulty: number | null
  predictedDifficulty: number | null
  qualityFlags: string[]
  citations: ElementGenerationCitation[]
}

export type GeneratedElementWithProvenance = GeneratedElementOriginal & {
  provenance: ElementGenerationProvenance | null
}

export type ElementGenerationWarning = {
  code: string
  message: string
}

export type ElementGenerationReviewSourceSummary = {
  sourceFile: string
  pageFrom: number | null
  pageTo: number | null
}

export type ElementGenerationDesignSummary = {
  title: string
  elementCount: number
  objectives: ElementGenerationObjective[]
  modules: Array<{
    moduleId: string
    moduleName: string
    elementCount: number
  }>
  sources: ElementGenerationReviewSourceSummary[]
  slots: Array<{
    sourceElementId: string
    moduleId: string
    objectiveId: string | null
    bloomLevel: ElementGenerationBloomLevel | null
    targetDifficulty: number | null
  }>
  warnings: ElementGenerationWarning[]
}

export type ElementGenerationPlanSummary = {
  elementCount: number
  elements: Array<{
    sourceElementId: string
    moduleId: string
    objectiveId: string | null
    preview: string
    bloomLevel: ElementGenerationBloomLevel | null
    targetDifficulty: number | null
    sources: ElementGenerationReviewSourceSummary[]
  }>
  warnings: ElementGenerationWarning[]
}

export const ELEMENT_GENERATION_CAPABILITIES = {
  elementTypes: ['SC', 'MC', 'KPRIM', 'FLASHCARD'],
  languages: ['de', 'en'],
  bloomLevels: ['remember', 'understand', 'apply', 'analyze', 'evaluate'],
  difficultyLevels: [1, 2, 3, 4, 5],
  reviewGates: {
    SC: ['DESIGN', 'PLAN'],
    MC: ['DESIGN', 'PLAN'],
    KPRIM: ['DESIGN', 'PLAN'],
    FLASHCARD: [],
  },
  supportsIndividualRegeneration: false,
} as const
